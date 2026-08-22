import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 4000) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: c.signal }); }
  finally { clearTimeout(t); }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const logs: string[] = [];
  const log = (msg: string) => {
    const line = `[${new Date().toISOString().split('T')[1].split('.')[0]}] ${msg}`;
    logs.push(line); console.log(line);
  };

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { data: isAdminData } = await supabase.rpc('is_admin', { _user_id: user.id });
    if (!isAdminData) throw new Error('Admin only');

    const body = await req.json() as { panelIds?: string[]; pteroServerIds?: number[]; serverId?: string };
    const panelIds = Array.isArray(body.panelIds) ? body.panelIds : [];
    const pteroServerIds = Array.isArray(body.pteroServerIds) ? body.pteroServerIds.map(Number).filter(Boolean) : [];
    const serverId = body.serverId;
    if (panelIds.length === 0 && pteroServerIds.length === 0) throw new Error('Tidak ada panel yang dipilih');

    log(`Admin ${user.email ?? user.id} memulai cleanup ${panelIds.length} panel DB + ${pteroServerIds.length} server untracked`);

    // Get server for optional Pterodactyl cleanup
    let serverDomain: string | null = null;
    let serverKey: string | null = null;
    let serverName = 'Server';
    if (serverId) {
      const { data: s } = await supabase
        .from('pterodactyl_servers')
        .select('name, domain, plta_key')
        .eq('id', serverId).single();
      if (s) { serverDomain = s.domain; serverKey = s.plta_key; serverName = s.name; }
    }

    const pteroHeaders = { 'Authorization': `Bearer ${serverKey}`, 'Accept': 'application/json' };

    // User Pterodactyl yang tidak boleh dihapus (dipakai Admin Panel)
    const protectedUserIds = new Set<number>();
    const { data: apList } = await supabase.from('admin_panels').select('ptero_user_id');
    for (const a of (apList || [])) if (a.ptero_user_id) protectedUserIds.add(Number(a.ptero_user_id));
    const { data: apSub } = await supabase.from('admin_panel_subusers').select('ptero_user_id');
    for (const a of (apSub || [])) if (a.ptero_user_id) protectedUserIds.add(Number(a.ptero_user_id));

    const deleteServerRemote = async (pteroServerId: number) => {
      if (!serverDomain || !serverKey) return;
      try {
        const r = await fetchWithTimeout(
          `${serverDomain}/api/application/servers/${pteroServerId}/force`,
          { method: 'DELETE', headers: pteroHeaders },
          6000,
        );
        log(`  Ptero server ${pteroServerId}: HTTP ${r.status}`);
      } catch (e) { log(`  Ptero server ${pteroServerId} gagal: ${e instanceof Error ? e.message : e}`); }
    };

    // Hapus user Pterodactyl bila sudah tidak punya server tersisa
    const deletedUsers = new Set<number>();
    const maybeDeletePteroUser = async (pteroUserId: number | null | undefined) => {
      if (!pteroUserId || !serverDomain || !serverKey) return;
      const uid = Number(pteroUserId);
      if (deletedUsers.has(uid) || protectedUserIds.has(uid)) return;
      try {
        const lr = await fetchWithTimeout(
          `${serverDomain}/api/application/servers?filter[user]=${uid}&per_page=1`,
          { headers: pteroHeaders }, 6000,
        );
        if (lr.ok) {
          const j = await lr.json();
          const remaining = (j?.data || []).length;
          if (remaining > 0) { log(`  Skip hapus user ${uid} — masih punya ${remaining} server`); return; }
        }
        const dr = await fetchWithTimeout(
          `${serverDomain}/api/application/users/${uid}`,
          { method: 'DELETE', headers: pteroHeaders }, 6000,
        );
        deletedUsers.add(uid);
        log(`  User Pterodactyl ${uid} dihapus: HTTP ${dr.status}`);
      } catch (e) { log(`  Gagal hapus user ${uid}: ${e instanceof Error ? e.message : e}`); }
    };

    // ===== 1. Panel yang ada di database =====
    const { data: panels } = panelIds.length > 0
      ? await supabase
          .from('user_panels')
          .select('id, username, ptero_server_id, ptero_user_id, user_id')
          .in('id', panelIds)
      : { data: [] as any[] };

    let deleted = 0; let failed = 0;
    for (const p of (panels || [])) {
      try {
        if (p.ptero_server_id) await deleteServerRemote(Number(p.ptero_server_id));

        const { error: delErr } = await supabase.from('user_panels').delete().eq('id', p.id);
        if (delErr) { failed++; log(`Gagal hapus ${p.username}: ${delErr.message}`); continue; }
        deleted++; log(`Terhapus: ${p.username}`);

        // Hapus user Ptero bila tidak dipakai panel lain di DB
        if (p.ptero_user_id) {
          const { count } = await supabase
            .from('user_panels')
            .select('*', { count: 'exact', head: true })
            .eq('ptero_user_id', p.ptero_user_id);
          if ((count ?? 0) === 0) await maybeDeletePteroUser(p.ptero_user_id);
          else log(`  Skip hapus user ${p.ptero_user_id} — masih dipakai ${count} panel lain`);
        }
      } catch (e) {
        failed++;
        log(`Error ${p.username}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // ===== 2. Server Pterodactyl untracked (tidak ada di database) =====
    let untrackedDeleted = 0;
    if (pteroServerIds.length > 0 && serverDomain && serverKey) {
      log(`Membersihkan ${pteroServerIds.length} server untracked di Pterodactyl...`);
      for (const sid of pteroServerIds) {
        // Cari owner dulu sebelum server dihapus
        let ownerId: number | null = null;
        try {
          const r = await fetchWithTimeout(
            `${serverDomain}/api/application/servers/${sid}`, { headers: pteroHeaders }, 5000,
          );
          if (r.ok) {
            const j = await r.json();
            ownerId = j?.attributes?.user != null ? Number(j.attributes.user) : null;
          }
        } catch { /* ignore */ }
        await deleteServerRemote(sid);
        untrackedDeleted++;
        await maybeDeletePteroUser(ownerId);
      }
    }

    // Catat ke activity_events sebagai admin_cleanup
    const totalDeleted = deleted + untrackedDeleted;
    if (totalDeleted > 0) {
      const { data: profile } = await supabase
        .from('profiles').select('full_name, email').eq('user_id', user.id).single();
      const actorName = profile?.full_name || profile?.email?.split('@')[0] || 'Admin';
      await supabase.from('activity_events').insert({
        kind: 'admin_cleanup',
        actor_user_id: user.id,
        actor_name: actorName,
        actor_role: 'admin',
        detail: `${totalDeleted}|${serverName}`,
        amount: totalDeleted,
      });
      log(`Aktivitas dicatat: ${actorName} membersihkan ${totalDeleted} panel offline di ${serverName}`);
    }

    if (deleted > 0) {
      // Kirim notifikasi ke setiap user yang panelnya dihapus
      const perUser = new Map<string, string[]>();
      for (const p of (panels || [])) {
        if (!p.user_id) continue;
        const arr = perUser.get(p.user_id) || [];
        arr.push(p.username);
        perUser.set(p.user_id, arr);
      }
      const notifRows = Array.from(perUser.entries()).map(([uid, usernames]) => ({
        title: '⚠️ Panel offline kamu dihapus',
        body: `Admin menghapus ${usernames.length} panel offline kamu (${usernames.join(', ')}) di server ${serverName}. Silakan buat panel baru bila masih dibutuhkan.`,
        audience: 'all' as const,
        target_user_id: uid,
        created_by: user.id,
        link_url: '/dashboard',
      }));
      if (notifRows.length > 0) {
        const { error: notifErr } = await supabase.from('notifications').insert(notifRows);
        if (notifErr) log(`Gagal kirim notifikasi: ${notifErr.message}`);
        else log(`Notifikasi terkirim ke ${notifRows.length} user`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      deleted, failed, untrackedDeleted,
      message: `Berhasil hapus ${deleted} panel database${untrackedDeleted > 0 ? ` + ${untrackedDeleted} server untracked` : ''}${failed > 0 ? ` (${failed} gagal)` : ''}. User Pterodactyl kosong ikut dibersihkan (${deletedUsers.size}).`,
      logs,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    log(`ERROR: ${msg}`);
    return new Response(JSON.stringify({ success: false, error: msg, logs }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
