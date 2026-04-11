import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServerStatus {
  serverId: string;
  serverName: string;
  isOnline: boolean;
  totalServers: number;
  totalUsers: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all active public Pterodactyl servers
    const { data: servers, error: serverError } = await supabase
      .from('pterodactyl_servers')
      .select('id, name, domain, plta_key, server_type')
      .eq('is_active', true)
      .eq('server_type', 'public');

    if (serverError) {
      console.error('Server fetch error:', serverError);
      throw new Error('Failed to fetch servers');
    }

    console.log(`Checking status for ${servers?.length || 0} public servers`);

    // Check status for each server in parallel
    const statusPromises = (servers || []).map(async (server): Promise<ServerStatus> => {
      try {
        // Try to get servers list from Pterodactyl API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch(`${server.domain}/api/application/servers`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${server.plta_key}`,
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.log(`Server ${server.name} returned status ${response.status}`);
          return {
            serverId: server.id,
            serverName: server.name,
            isOnline: false,
            totalServers: 0,
            totalUsers: 0,
          };
        }

        const data = await response.json();
        const totalServers = data.meta?.pagination?.total || data.data?.length || 0;

        // Also get users count
        const usersResponse = await fetch(`${server.domain}/api/application/users`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${server.plta_key}`,
            'Accept': 'application/json',
          },
        });

        let totalUsers = 0;
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          totalUsers = usersData.meta?.pagination?.total || usersData.data?.length || 0;
        }

        console.log(`Server ${server.name} is online with ${totalServers} servers and ${totalUsers} users`);

        return {
          serverId: server.id,
          serverName: server.name,
          isOnline: true,
          totalServers,
          totalUsers,
        };
      } catch (error) {
        console.error(`Error checking server ${server.name}:`, error);
        return {
          serverId: server.id,
          serverName: server.name,
          isOnline: false,
          totalServers: 0,
          totalUsers: 0,
        };
      }
    });

    const statuses = await Promise.all(statusPromises);

    console.log('Public server statuses:', statuses);

    return new Response(
      JSON.stringify({
        success: true,
        statuses,
        lastUpdated: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
    console.error('Error in public-server-status:', errorMessage);
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
