import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const logs: string[] = [];
  const log = (m: string) => { const l = `[${new Date().toISOString().split('T')[1].split('.')[0]}] ${m}`; logs.push(l); console.log(l); };

  const fetchWT = async (url: string, opt: RequestInit, ms = 6000) => {
    const c = new AbortController(); const id = setTimeout(() => c.abort(), ms);
    try { return await fetch(url, { ...opt, signal: c.signal }); } finally { clearTimeout(id); }
  };

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error('Unauthorized');

    const { adminPanelId } = await req.json();
    if (!adminPanelId) throw new Error('adminPanelId wajib diisi');

    const { data: isAdminData } = await supabase.rpc('is_admin', { _user_id: user.id });
    const isAdmin = !!isAdminData;

    let q = supabase.from('admin_panels').select('*, pterodactyl_servers(id,domain,plta_key)').eq('id', adminPanelId);
    if (!isAdmin) q = q.eq('user_id', user.id);
    const { data: ap, error: apErr } = await q.single();
    if (apErr || !ap) throw new Error('Admin Panel tidak ditemukan atau bukan milik kamu');

    const ptero: any = ap.pterodactyl_servers;
    const domain = ptero?.domain;
    const plta = ptero?.plta_key || ap.plta_key;
    log(`Admin panel ditemukan: ${ap.username} @ ${domain}`);

    let alive = false;
    if (domain && plta) {
      try {
        const p = await fetchWT(`${domain}/api/application/users?per_page=1`, {
          headers: { 'Authorization': `Bearer ${plta}`, 'Accept': 'application/json' },
        }, 2500);
        alive = p.ok;
        log(alive ? `Server online (${p.status})` : `Server merespon ${p.status}`);
      } catch (e) { log(`Server offline: ${e instanceof Error ? e.message : e}`); }
    }

    if (alive && ap.ptero_user_id) {
      log(`Mencari semua server milik ptero user ${ap.ptero_user_id}...`);
      try {
        const listRes = await fetchWT(
          `${domain}/api/application/servers?filter[user]=${ap.ptero_user_id}&per_page=100`,
          { headers: { 'Authorization': `Bearer ${plta}`, 'Accept': 'application/json' } },
          6000
        );
        if (listRes.ok) {
          const j = await listRes.json();
          const servers = (j.data || []) as any[];
          log(`Ditemukan ${servers.length} server, menghapus...`);
          for (const s of servers) {
            const sid = s.attributes?.id;
            if (!sid) continue;
            try {
              const dr = await fetchWT(`${domain}/api/application/servers/${sid}/force`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${plta}`, 'Accept': 'application/json' },
              }, 6000);
              log(`  Server ${sid}: HTTP ${dr.status}`);
            } catch (e) { log(`  Server ${sid} gagal: ${e instanceof Error ? e.message : e}`); }
          }
        } else {
          log(`Gagal list server HTTP ${listRes.status}`);
        }
      } catch (e) { log(`List server error: ${e instanceof Error ? e.message : e}`); }

      log(`Menghapus user Pterodactyl ${ap.ptero_user_id}...`);
      try {
        const ur = await fetchWT(`${domain}/api/application/users/${ap.ptero_user_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${plta}`, 'Accept': 'application/json' },
        }, 6000);
        log(`  User: HTTP ${ur.status}`);
      } catch (e) { log(`  Gagal hapus user: ${e instanceof Error ? e.message : e}`); }
    } else {
      log('Skip Pterodactyl (offline atau tidak ada user id)');
    }

    await supabase.from('admin_panel_servers').delete().eq('admin_panel_id', ap.id);
    await supabase.from('admin_panel_subusers').delete().eq('admin_panel_id', ap.id);
    const { error: delErr } = await supabase.from('admin_panels').delete().eq('id', ap.id);
    if (delErr) throw new Error(`Gagal hapus dari DB: ${delErr.message}`);
    log('Admin Panel terhapus dari database — slot dikembalikan');

    return new Response(JSON.stringify({
      success: true,
      message: 'Admin Panel berhasil dihapus. Slot pembuatan Admin Panel di server ini telah dikembalikan.',
      logs,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`ERROR: ${msg}`);
    return new Response(JSON.stringify({ success: false, error: msg, logs }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
