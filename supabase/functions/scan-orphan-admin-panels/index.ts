import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const fetchWT = async (url: string, opt: RequestInit, ms = 8000) => {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opt, signal: c.signal }); } finally { clearTimeout(t); }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user }, error: aErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (aErr || !user) throw new Error('Unauthorized');
    const { data: isAdm } = await supabase.rpc('is_admin', { _user_id: user.id });
    if (!isAdm) throw new Error('Admin only');

    const { serverId } = await req.json();
    if (!serverId) throw new Error('Missing serverId');

    const { data: server, error: sErr } = await supabase
      .from('pterodactyl_servers')
      .select('id, name, domain, plta_key')
      .eq('id', serverId).single();
    if (sErr || !server) throw new Error('Server tidak ditemukan');

    const { data: panels, error: pErr } = await supabase
      .from('admin_panels')
      .select('id, username, email, ptero_user_id, user_id, created_at')
      .eq('server_id', serverId)
      .order('created_at', { ascending: false });
    if (pErr) throw new Error(pErr.message);

    // Bulk fetch all Ptero users
    let serverAlive = false;
    const pteroUserSet = new Set<number>();
    try {
      let page = 1;
      for (let i = 0; i < 50; i++) {
        const r = await fetchWT(
          `${server.domain}/api/application/users?per_page=100&page=${page}`,
          { headers: { 'Authorization': `Bearer ${server.plta_key}`, 'Accept': 'application/json' } },
          10000,
        );
        if (!r.ok) { serverAlive = page > 1; break; }
        serverAlive = true;
        const body = await r.json();
        for (const u of (body?.data || [])) {
          const id = u?.attributes?.id;
          if (id) pteroUserSet.add(Number(id));
        }
        const totalPages = body?.meta?.pagination?.total_pages ?? 1;
        if (page >= totalPages) break;
        page++;
      }
    } catch { /* stays false */ }

    // Owners
    const userIds = Array.from(new Set((panels || []).map(p => p.user_id)));
    const { data: profiles } = await supabase
      .from('profiles').select('user_id, email, full_name')
      .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
    const profMap: Record<string, { email: string; full_name: string | null }> = {};
    for (const p of (profiles || [])) profMap[p.user_id] = { email: p.email, full_name: p.full_name };

    type Result = {
      id: string; username: string; email: string;
      owner_email: string | null; owner_name: string | null;
      ptero_user_id: number | null;
      status: 'orphan' | 'unreachable' | 'online';
      created_at: string;
    };
    const results: Result[] = (panels || []).map(p => {
      let status: Result['status'];
      if (!serverAlive) status = 'unreachable';
      else if (!p.ptero_user_id || !pteroUserSet.has(Number(p.ptero_user_id))) status = 'orphan';
      else status = 'online';
      return {
        id: p.id, username: p.username, email: p.email,
        owner_email: profMap[p.user_id]?.email ?? null,
        owner_name: profMap[p.user_id]?.full_name ?? null,
        ptero_user_id: p.ptero_user_id, status, created_at: p.created_at,
      };
    });

    return new Response(JSON.stringify({
      success: true,
      serverAlive,
      serverName: server.name,
      total: results.length,
      orphanCount: results.filter(r => r.status === 'orphan').length,
      unreachableCount: results.filter(r => r.status === 'unreachable').length,
      onlineCount: results.filter(r => r.status === 'online').length,
      panels: results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});