import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { panelId } = await req.json();
    if (!panelId) throw new Error('panelId required');

    const { data: isAdminData } = await supabase.rpc('is_admin', { _user_id: user.id });
    const isAdmin = !!isAdminData;

    let q = supabase.from('user_panels').select(`
        id, user_id, ptero_identifier,
        pterodactyl_servers ( domain, pltc_key )
      `).eq('id', panelId);
    if (!isAdmin) q = q.eq('user_id', user.id);
    const { data: panel, error: pErr } = await q.single();
    if (pErr || !panel) throw new Error('Panel tidak ditemukan');
    const srv: any = panel.pterodactyl_servers;
    if (!srv?.pltc_key || !srv?.domain) throw new Error('Server config kosong');
    if (!panel.ptero_identifier) throw new Error('Identifier belum siap');

    const resp = await fetch(`${srv.domain}/api/client/servers/${panel.ptero_identifier}/websocket`, {
      headers: {
        'Authorization': `Bearer ${srv.pltc_key}`,
        'Accept': 'application/json',
      },
    });
    const txt = await resp.text();
    if (!resp.ok) throw new Error(`WS token error ${resp.status}: ${txt.slice(0,200)}`);
    const j = JSON.parse(txt);
    return new Response(JSON.stringify({
      success: true,
      token: j?.data?.token,
      socket: j?.data?.socket,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || 'error' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});