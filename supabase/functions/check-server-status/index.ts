import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServerStatus {
  serverId: string;
  isOnline: boolean;
  totalServers: number;
  totalUsers: number;
  error?: string;
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

    // Parse request body
    const { serverIds } = await req.json();
    
    if (!serverIds || !Array.isArray(serverIds)) {
      throw new Error('Missing required field: serverIds (array)');
    }

    console.log('Checking status for servers:', serverIds);

    // Get all Pterodactyl servers
    const { data: servers, error: serverError } = await supabase
      .from('pterodactyl_servers')
      .select('id, domain, plta_key')
      .in('id', serverIds);

    if (serverError) {
      console.error('Server fetch error:', serverError);
      throw new Error('Failed to fetch servers');
    }

    // Check status for each server in parallel
    const statusPromises = servers.map(async (server): Promise<ServerStatus> => {
      try {
        // Try to get servers list from Pterodactyl API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

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
          console.log(`Server ${server.id} returned status ${response.status}`);
          return {
            serverId: server.id,
            isOnline: false,
            totalServers: 0,
            totalUsers: 0,
            error: `HTTP ${response.status}`,
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

        console.log(`Server ${server.id} is online with ${totalServers} servers and ${totalUsers} users`);

        return {
          serverId: server.id,
          isOnline: true,
          totalServers,
          totalUsers,
        };
      } catch (error) {
        console.error(`Error checking server ${server.id}:`, error);
        return {
          serverId: server.id,
          isOnline: false,
          totalServers: 0,
          totalUsers: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const statuses = await Promise.all(statusPromises);

    console.log('Server statuses:', statuses);

    return new Response(
      JSON.stringify({
        success: true,
        statuses,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
    console.error('Error in check-server-status:', errorMessage);
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
