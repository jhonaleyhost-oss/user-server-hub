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

    // Admin override
    const { data: isAdminData } = await supabase.rpc('is_admin', { _user_id: user.id });
    const isAdmin = !!isAdminData;

    let q = supabase.from('user_panels').select(`
        id, user_id, ptero_server_id, ptero_identifier, username,
        pterodactyl_servers ( id, domain, plta_key, pltc_key )
      `).eq('id', panelId);
    if (!isAdmin) q = q.eq('user_id', user.id);
    const { data: panel, error: pErr } = await q.single();
    if (pErr || !panel) throw new Error('Panel tidak ditemukan');

    let identifier = panel.ptero_identifier;
    const srv: any = panel.pterodactyl_servers;

    if (!identifier && panel.ptero_server_id && srv) {
      // Fetch from Pterodactyl
      const resp = await fetch(`${srv.domain}/api/application/servers/${panel.ptero_server_id}`, {
        headers: {
          'Authorization': `Bearer ${srv.plta_key}`,
          'Accept': 'application/json',
        },
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`Gagal ambil identifier: ${resp.status} ${t.slice(0,200)}`);
      }
      const j = await resp.json();
      identifier = j?.attributes?.identifier;
      if (!identifier) throw new Error('Identifier tidak ditemukan di response Pterodactyl');

      await supabase.from('user_panels')
        .update({ ptero_identifier: identifier })
        .eq('id', panel.id);
    }

    if (!identifier) throw new Error('Identifier server tidak tersedia');

    return new Response(JSON.stringify({
      success: true,
      identifier,
      panelId: panel.id,
      username: panel.username,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || 'error' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});