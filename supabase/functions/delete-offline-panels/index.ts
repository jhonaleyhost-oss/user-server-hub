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

    const { panelIds, serverId } = await req.json() as { panelIds: string[]; serverId?: string };
    if (!Array.isArray(panelIds) || panelIds.length === 0) throw new Error('panelIds wajib');

    log(`Admin ${user.email ?? user.id} memulai cleanup ${panelIds.length} panel offline`);

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

    // Get panel detail untuk hapus di Pterodactyl bila mungkin
    const { data: panels } = await supabase
      .from('user_panels')
      .select('id, username, ptero_server_id, ptero_user_id, user_id')
      .in('id', panelIds);

    let deleted = 0; let failed = 0;
    for (const p of (panels || [])) {
      try {
        // Best-effort hapus di Pterodactyl (lewati jika error/offline)
        if (serverDomain && serverKey && p.ptero_server_id) {
          try {
            await fetchWithTimeout(
              `${serverDomain}/api/application/servers/${p.ptero_server_id}/force`,
              { method: 'DELETE', headers: { 'Authorization': `Bearer ${serverKey}`, 'Accept': 'application/json' } },
              3000
            );
          } catch { /* ignore */ }
        }
        const { error: delErr } = await supabase.from('user_panels').delete().eq('id', p.id);
        if (delErr) { failed++; log(`Gagal hapus ${p.username}: ${delErr.message}`); }
        else { deleted++; log(`Terhapus: ${p.username}`); }
      } catch (e) {
        failed++;
        log(`Error ${p.username}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Catat ke activity_events sebagai admin_cleanup
    if (deleted > 0) {
      const { data: profile } = await supabase
        .from('profiles').select('full_name, email').eq('user_id', user.id).single();
      const actorName = profile?.full_name || profile?.email?.split('@')[0] || 'Admin';
      await supabase.from('activity_events').insert({
        kind: 'admin_cleanup',
        actor_user_id: user.id,
        actor_name: actorName,
        actor_role: 'admin',
        detail: `${deleted}|${serverName}`,
        amount: deleted,
      });
      log(`Aktivitas dicatat: ${actorName} membersihkan ${deleted} panel offline di ${serverName}`);

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
      deleted, failed,
      message: `Berhasil hapus ${deleted} panel offline${failed > 0 ? ` (${failed} gagal)` : ''}.`,
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