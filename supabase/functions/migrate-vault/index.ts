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

    // Check admin
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: user.id });
    if (!isAdmin) throw new Error('Admin only');

    // Get all servers that still have plaintext keys (plta_key column exists)
    const { data: servers, error } = await supabase
      .from('pterodactyl_servers')
      .select('id, plta_key, pltc_key')
      .is('plta_vault_id', null);

    if (error) throw new Error(`Fetch error: ${error.message}`);

    let migrated = 0;
    for (const server of (servers || [])) {
      if (server.plta_key && server.pltc_key) {
        const { error: storeError } = await supabase.rpc('store_server_keys', {
          _server_id: server.id,
          _plta_key: server.plta_key,
          _pltc_key: server.pltc_key,
        });
        if (storeError) {
          console.error(`Failed to migrate server ${server.id}:`, storeError);
        } else {
          migrated++;
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, migrated, total: servers?.length || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
