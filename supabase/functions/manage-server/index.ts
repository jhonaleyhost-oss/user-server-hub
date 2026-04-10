import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    // Admin check
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: user.id });
    if (!isAdmin) throw new Error('Admin access required');

    const body = await req.json();
    const { action, serverId, serverData, plta_key, pltc_key } = body;

    if (action === 'create') {
      // Insert server without keys
      const { name, domain, server_type, location_id, egg_id, is_active } = serverData;
      const { data: newServer, error: insertError } = await supabase
        .from('pterodactyl_servers')
        .insert({ name, domain, server_type, location_id, egg_id, is_active })
        .select('id')
        .single();

      if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

      // Store keys in vault
      if (plta_key && pltc_key) {
        const { error: vaultError } = await supabase.rpc('store_server_keys', {
          _server_id: newServer.id,
          _plta_key: plta_key,
          _pltc_key: pltc_key,
        });
        if (vaultError) throw new Error(`Vault store failed: ${vaultError.message}`);
      }

      return new Response(
        JSON.stringify({ success: true, server: newServer }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'update') {
      if (!serverId) throw new Error('serverId required');

      // Update server metadata (no keys)
      const { name, domain, server_type, location_id, egg_id, is_active } = serverData;
      const { error: updateError } = await supabase
        .from('pterodactyl_servers')
        .update({ name, domain, server_type, location_id, egg_id, is_active })
        .eq('id', serverId);

      if (updateError) throw new Error(`Update failed: ${updateError.message}`);

      // Update vault keys if provided
      if (plta_key && pltc_key) {
        const { error: vaultError } = await supabase.rpc('store_server_keys', {
          _server_id: serverId,
          _plta_key: plta_key,
          _pltc_key: pltc_key,
        });
        if (vaultError) throw new Error(`Vault update failed: ${vaultError.message}`);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      throw new Error('Invalid action. Use "create" or "update".');
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
