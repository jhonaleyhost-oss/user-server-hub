import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeletePanelRequest {
  panelId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    // Parse request body
    const { panelId }: DeletePanelRequest = await req.json();
    
    console.log('Request to delete panel:', panelId);

    if (!panelId) {
      throw new Error('Missing required field: panelId');
    }

    // Get panel details (with server info for API keys)
    const { data: panelData, error: panelError } = await supabase
      .from('user_panels')
      .select(`
        *,
        pterodactyl_servers (
          id,
          domain,
          plta_key
        )
      `)
      .eq('id', panelId)
      .eq('user_id', user.id)
      .single();

    if (panelError || !panelData) {
      console.error('Panel fetch error:', panelError);
      throw new Error('Panel tidak ditemukan atau Anda tidak memiliki akses');
    }

    console.log('Panel found:', panelData.username, 'Ptero Server ID:', panelData.ptero_server_id, 'Ptero User ID:', panelData.ptero_user_id);

    const pteroServer = panelData.pterodactyl_servers;

    // Step 1: Delete server in Pterodactyl (if exists)
    if (panelData.ptero_server_id) {
      console.log('Deleting server from Pterodactyl...');
      const deleteServerResponse = await fetch(
        `${pteroServer.domain}/api/application/servers/${panelData.ptero_server_id}/force`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${pteroServer.plta_key}`,
            'Accept': 'application/json',
          },
        }
      );

      console.log('Delete server response:', deleteServerResponse.status);

      if (!deleteServerResponse.ok && deleteServerResponse.status !== 404) {
        const errorText = await deleteServerResponse.text();
        console.error('Failed to delete Pterodactyl server:', deleteServerResponse.status, errorText);
        // Continue anyway - we still want to delete from our database
      } else {
        console.log('Server deleted from Pterodactyl successfully');
      }
    }

    // Step 2: Delete user in Pterodactyl (if exists)
    // Note: Only delete if no other panels use this user
    if (panelData.ptero_user_id) {
      // Check if other panels use the same ptero_user_id
      const { count } = await supabase
        .from('user_panels')
        .select('*', { count: 'exact', head: true })
        .eq('ptero_user_id', panelData.ptero_user_id)
        .neq('id', panelId);

      if (count === 0) {
        console.log('No other panels use this Pterodactyl user, deleting user...');
        const deleteUserResponse = await fetch(
          `${pteroServer.domain}/api/application/users/${panelData.ptero_user_id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${pteroServer.plta_key}`,
              'Accept': 'application/json',
            },
          }
        );

        console.log('Delete user response:', deleteUserResponse.status);

        if (!deleteUserResponse.ok && deleteUserResponse.status !== 404) {
          const errorText = await deleteUserResponse.text();
          console.error('Failed to delete Pterodactyl user:', deleteUserResponse.status, errorText);
        } else {
          console.log('User deleted from Pterodactyl successfully');
        }
      } else {
        console.log('Other panels still use this Pterodactyl user, skipping user deletion');
      }
    }

    // Step 3: Delete from our database
    console.log('Deleting panel from database...');
    const { error: deleteError } = await supabase
      .from('user_panels')
      .delete()
      .eq('id', panelId);

    if (deleteError) {
      console.error('Database delete error:', deleteError);
      throw new Error(`Failed to delete panel from database: ${deleteError.message}`);
    }

    console.log('Panel deleted successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Panel berhasil dihapus dari Pterodactyl dan database!',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus panel';
    console.error('Error in delete-panel:', errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
