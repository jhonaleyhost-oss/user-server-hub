import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 6000) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: c.signal }); }
  finally { clearTimeout(t); }
};

// Jalankan task paralel dengan batas konkurensi
const runPool = async <T>(items: T[], limit: number, fn: (item: T) => Promise<void>) => {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(fn));
  }
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

    const body = await req.json() as {
      panelIds?: string[];
      pteroServerIds?: number[];
      ghosts?: { serverId: number; userId?: number | null }[];
      serverId?: string;
    };
    const panelIds = Array.isArray(body.panelIds) ? body.panelIds : [];
    const ghosts: { serverId: number; userId?: number | null }[] = Array.isArray(body.ghosts)
      ? body.ghosts.filter(g => g && Number(g.serverId))
      : (Array.isArray(body.pteroServerIds) ? body.pteroServerIds.map(id => ({ serverId: Number(id), userId: null })) : []);
    const serverId = body.serverId;
    if (panelIds.length === 0 && ghosts.length === 0) throw new Error('Tidak ada panel yang dipilih');

    log(`Cleanup: ${panelIds.length} panel DB + ${ghosts.length} server untracked`);

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
    const remoteReady = !!(serverDomain && serverKey);

    // Ambil data panel + user Ptero yang dilindungi secara paralel
    const [panelsRes, apRes, apSubRes] = await Promise.all([
      panelIds.length > 0
        ? supabase.from('user_panels').select('id, username, ptero_server_id, ptero_user_id, user_id').in('id', panelIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('admin_panels').select('ptero_user_id'),
      supabase.from('admin_panel_subusers').select('ptero_user_id'),
    ]);
    const panels = (panelsRes as any).data || [];
    const protectedUserIds = new Set<number>();
    for (const a of ((apRes as any).data || [])) if (a.ptero_user_id) protectedUserIds.add(Number(a.ptero_user_id));
    for (const a of ((apSubRes as any).data || [])) if (a.ptero_user_id) protectedUserIds.add(Number(a.ptero_user_id));

    // ===== 1. Hapus server di Pterodactyl (paralel) =====
    const targetServers: number[] = [
      ...panels.filter((p: any) => p.ptero_server_id).map((p: any) => Number(p.ptero_server_id)),
      ...ghosts.map(g => Number(g.serverId)),
    ];
    let remoteOk = 0, remoteFail = 0;
    if (remoteReady && targetServers.length > 0) {
      await runPool(targetServers, 25, async (sid) => {
        try {
          const r = await fetchWithTimeout(
            `${serverDomain}/api/application/servers/${sid}/force`,
            { method: 'DELETE', headers: pteroHeaders }, 8000,
          );
          if (r.ok || r.status === 404) remoteOk++; else { remoteFail++; log(`Server ${sid}: HTTP ${r.status}`); }
        } catch { remoteFail++; }
      });
      log(`Server Pterodactyl dihapus: ${remoteOk} sukses, ${remoteFail} gagal`);
    }

    // ===== 2. Hapus panel dari database (satu query) =====
    let deleted = 0; let failed = 0;
    if (panels.length > 0) {
      const { error: delErr } = await supabase
        .from('user_panels').delete().in('id', panels.map((p: any) => p.id));
      if (delErr) { failed = panels.length; log(`Gagal hapus dari DB: ${delErr.message}`); }
      else { deleted = panels.length; log(`${deleted} panel terhapus dari database`); }
    }

    // ===== 3. Hapus user Pterodactyl yang sudah tidak punya panel =====
    const candidateUsers = new Set<number>();
    if (deleted > 0) for (const p of panels) if (p.ptero_user_id) candidateUsers.add(Number(p.ptero_user_id));
    for (const g of ghosts) if (g.userId) candidateUsers.add(Number(g.userId));
    for (const uid of protectedUserIds) candidateUsers.delete(uid);

    let usersDeleted = 0;
    if (remoteReady && candidateUsers.size > 0) {
      // Cek sekaligus siapa yang masih dipakai panel lain di DB
      const ids = Array.from(candidateUsers);
      const { data: stillUsed } = await supabase
        .from('user_panels').select('ptero_user_id').in('ptero_user_id', ids);
      for (const r of (stillUsed || [])) candidateUsers.delete(Number(r.ptero_user_id));

      await runPool(Array.from(candidateUsers), 25, async (uid) => {
        try {
          const dr = await fetchWithTimeout(
            `${serverDomain}/api/application/users/${uid}`,
            { method: 'DELETE', headers: pteroHeaders }, 8000,
          );
          if (dr.ok || dr.status === 404) usersDeleted++;
        } catch { /* ignore */ }
      });
      log(`User Pterodactyl dihapus: ${usersDeleted}`);
    }

    const totalDeleted = deleted + (remoteReady ? ghosts.length : 0);

    // Aktivitas + notifikasi (non-blocking untuk kecepatan respons)
    if (totalDeleted > 0) {
      const { data: profile } = await supabase
        .from('profiles').select('full_name, email').eq('user_id', user.id).single();
      const actorName = profile?.full_name || profile?.email?.split('@')[0] || 'Admin';
      const perUser = new Map<string, string[]>();
      if (deleted > 0) {
        for (const p of panels) {
          if (!p.user_id) continue;
          const arr = perUser.get(p.user_id) || [];
          arr.push(p.username);
          perUser.set(p.user_id, arr);
        }
      }
      const notifRows = Array.from(perUser.entries()).map(([uid, usernames]) => ({
        title: '⚠️ Panel offline kamu dihapus',
        body: `Admin menghapus ${usernames.length} panel offline kamu (${usernames.join(', ')}) di server ${serverName}. Silakan buat panel baru bila masih dibutuhkan.`,
        audience: 'all' as const,
        target_user_id: uid,
        created_by: user.id,
        link_url: '/dashboard',
      }));
      await Promise.all([
        supabase.from('activity_events').insert({
          kind: 'admin_cleanup',
          actor_user_id: user.id,
          actor_name: actorName,
          actor_role: 'admin',
          detail: `${totalDeleted}|${serverName}`,
          amount: totalDeleted,
        }),
        notifRows.length > 0 ? supabase.from('notifications').insert(notifRows) : Promise.resolve(null),
      ]);
      log(`Aktivitas & ${notifRows.length} notifikasi tercatat`);
    }

    return new Response(JSON.stringify({
      success: true,
      deleted, failed,
      untrackedDeleted: remoteReady ? ghosts.length : 0,
      usersDeleted,
      deletedPanelIds: deleted > 0 ? panels.map((p: any) => p.id) : [],
      deletedPteroServerIds: ghosts.map(g => Number(g.serverId)),
      message: `Berhasil hapus ${deleted} panel${ghosts.length > 0 ? ` + ${ghosts.length} server untracked` : ''}${usersDeleted > 0 ? `, ${usersDeleted} user Pterodactyl dibersihkan` : ''}${failed > 0 ? ` (${failed} gagal)` : ''}.`,
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
