import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 4000) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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

    const { serverId } = await req.json();
    if (!serverId) throw new Error('Missing serverId');

    const { data: server, error: srvErr } = await supabase
      .from('pterodactyl_servers')
      .select('id, name, domain, plta_key')
      .eq('id', serverId)
      .single();
    if (srvErr || !server) throw new Error('Server tidak ditemukan');

    const { data: panels, error: panelErr } = await supabase
      .from('user_panels')
      .select('id, username, email, ptero_server_id, ptero_user_id, created_at, user_id, ram, cpu, disk, panel_type')
      .eq('server_id', serverId)
      .order('created_at', { ascending: false });
    if (panelErr) throw new Error(panelErr.message);

    // Optional pre-check server alive — if dead, mark ALL panels as offline (server unreachable)
    let serverAlive = false;
    try {
      const ping = await fetchWithTimeout(`${server.domain}/api/application/servers?per_page=1`, {
        headers: { 'Authorization': `Bearer ${server.plta_key}`, 'Accept': 'application/json' },
      }, 3000);
      serverAlive = ping.ok;
    } catch { serverAlive = false; }

    // Fetch profiles map for owner name
    const userIds = Array.from(new Set((panels || []).map(p => p.user_id)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, full_name')
      .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);
    const profileMap: Record<string, { email: string; full_name: string | null }> = {};
    for (const p of (profiles || [])) profileMap[p.user_id] = { email: p.email, full_name: p.full_name };

    type Result = {
      id: string; username: string; email: string; owner_email: string | null; owner_name: string | null;
      ptero_server_id: number | null; status: 'offline' | 'online' | 'unknown';
      panel_type: string | null; ram: number; cpu: number; disk: number; created_at: string;
    };
    const results: Result[] = [];

    if (!serverAlive) {
      // Server itself dead — semua panel di server ini dianggap offline (tidak bisa diakses)
      for (const p of (panels || [])) {
        results.push({
          id: p.id, username: p.username, email: p.email,
          owner_email: profileMap[p.user_id]?.email ?? null,
          owner_name: profileMap[p.user_id]?.full_name ?? null,
          ptero_server_id: p.ptero_server_id, status: 'offline',
          panel_type: p.panel_type, ram: p.ram, cpu: p.cpu, disk: p.disk, created_at: p.created_at,
        });
      }
    } else {
      // Cek per-panel di Pterodactyl (parallel batches of 10)
      const batchSize = 10;
      const list = panels || [];
      for (let i = 0; i < list.length; i += batchSize) {
        const batch = list.slice(i, i + batchSize);
        const checks = await Promise.all(batch.map(async (p): Promise<Result> => {
          if (!p.ptero_server_id) {
            return {
              id: p.id, username: p.username, email: p.email,
              owner_email: profileMap[p.user_id]?.email ?? null,
              owner_name: profileMap[p.user_id]?.full_name ?? null,
              ptero_server_id: null, status: 'offline',
              panel_type: p.panel_type, ram: p.ram, cpu: p.cpu, disk: p.disk, created_at: p.created_at,
            };
          }
          try {
            const r = await fetchWithTimeout(
              `${server.domain}/api/application/servers/${p.ptero_server_id}`,
              { headers: { 'Authorization': `Bearer ${server.plta_key}`, 'Accept': 'application/json' } },
              4000
            );
            const status: Result['status'] = r.status === 404 ? 'offline' : r.ok ? 'online' : 'unknown';
            return {
              id: p.id, username: p.username, email: p.email,
              owner_email: profileMap[p.user_id]?.email ?? null,
              owner_name: profileMap[p.user_id]?.full_name ?? null,
              ptero_server_id: p.ptero_server_id, status,
              panel_type: p.panel_type, ram: p.ram, cpu: p.cpu, disk: p.disk, created_at: p.created_at,
            };
          } catch {
            return {
              id: p.id, username: p.username, email: p.email,
              owner_email: profileMap[p.user_id]?.email ?? null,
              owner_name: profileMap[p.user_id]?.full_name ?? null,
              ptero_server_id: p.ptero_server_id, status: 'unknown',
              panel_type: p.panel_type, ram: p.ram, cpu: p.cpu, disk: p.disk, created_at: p.created_at,
            };
          }
        }));
        results.push(...checks);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      serverAlive,
      serverName: server.name,
      total: results.length,
      offlineCount: results.filter(r => r.status === 'offline').length,
      onlineCount: results.filter(r => r.status === 'online').length,
      panels: results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});