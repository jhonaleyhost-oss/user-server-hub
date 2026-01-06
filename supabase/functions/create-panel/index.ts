import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreatePanelRequest {
  username: string;
  serverId: string;
  ram: number; // in MB
  cpu: number; // percentage
  disk: number; // in MB
}

interface PterodactylServer {
  id: string;
  domain: string;
  plta_key: string;
  pltc_key: string;
  egg_id: number;
  location_id: number;
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
    const { username, serverId, ram, cpu, disk }: CreatePanelRequest = await req.json();
    
    console.log('Request body:', { username, serverId, ram, cpu, disk });

    if (!username || !serverId) {
      throw new Error('Missing required fields: username and serverId');
    }

    // Get Pterodactyl server details
    const { data: serverData, error: serverError } = await supabase
      .from('pterodactyl_servers')
      .select('id, domain, plta_key, pltc_key, egg_id, location_id')
      .eq('id', serverId)
      .single();

    if (serverError || !serverData) {
      console.error('Server fetch error:', serverError);
      throw new Error('Pterodactyl server not found');
    }

    const pteroServer: PterodactylServer = serverData;
    console.log('Pterodactyl server found:', pteroServer.domain);

    const panelEmail = `${username}@valtp.net`;
    const panelPassword = `${username}2323`;

    // Step 1: Create user in Pterodactyl
    console.log('Creating user in Pterodactyl...');
    const createUserResponse = await fetch(`${pteroServer.domain}/api/application/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pteroServer.plta_key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email: panelEmail,
        username: username,
        first_name: username,
        last_name: 'User',
        password: panelPassword,
      }),
    });

    let pteroUserId: number;

    if (!createUserResponse.ok) {
      const errorText = await createUserResponse.text();
      console.log('Create user response:', createUserResponse.status, errorText);
      
      // Check if user already exists (422 usually means duplicate)
      if (createUserResponse.status === 422) {
        console.log('User might already exist, trying to find existing user...');
        
        // Try to find existing user by username (since username is what's duplicated)
        const findUserResponse = await fetch(
          `${pteroServer.domain}/api/application/users?filter[username]=${encodeURIComponent(username)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${pteroServer.plta_key}`,
              'Accept': 'application/json',
            },
          }
        );
        
        console.log('Find user response status:', findUserResponse.status);

        if (findUserResponse.ok) {
          const findUserData = await findUserResponse.json();
          if (findUserData.data && findUserData.data.length > 0) {
            pteroUserId = findUserData.data[0].attributes.id;
            console.log('Found existing user with ID:', pteroUserId);
          } else {
            throw new Error('User exists but could not be found');
          }
        } else {
          throw new Error(`Failed to find existing user: ${await findUserResponse.text()}`);
        }
      } else {
        throw new Error(`Failed to create Pterodactyl user: ${errorText}`);
      }
    } else {
      const userResult = await createUserResponse.json();
      pteroUserId = userResult.attributes.id;
      console.log('Created Pterodactyl user with ID:', pteroUserId);
    }

    // Step 2: Create server in Pterodactyl
    console.log('Creating server in Pterodactyl...');
    const createServerResponse = await fetch(`${pteroServer.domain}/api/application/servers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pteroServer.plta_key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        name: username,
        user: pteroUserId,
        egg: pteroServer.egg_id,
        docker_image: 'ghcr.io/parkervcp/yolks:nodejs_18',
        startup: 'npm start',
        environment: {
          INST: 'npm',
          USER_UPLOAD: '0',
          AUTO_UPDATE: '0',
          CMD_RUN: 'npm start',
        },
        limits: {
          memory: ram === 0 ? 0 : ram, // 0 = unlimited
          swap: 0,
          disk: disk === 0 ? 0 : disk,
          io: 500,
          cpu: cpu === 0 ? 0 : cpu,
        },
        feature_limits: {
          databases: 0,
          backups: 1,
          allocations: 1,
        },
        allocation: {
          default: null,
        },
        deploy: {
          locations: [pteroServer.location_id],
          dedicated_ip: false,
          port_range: [],
        },
      }),
    });

    if (!createServerResponse.ok) {
      const errorText = await createServerResponse.text();
      console.error('Create server error:', createServerResponse.status, errorText);
      throw new Error(`Failed to create Pterodactyl server: ${errorText}`);
    }

    const serverResult = await createServerResponse.json();
    const pteroServerId = serverResult.attributes.id;
    console.log('Created Pterodactyl server with ID:', pteroServerId);

    // Step 3: Save to database
    console.log('Saving panel to database...');
    const { data: panelData, error: insertError } = await supabase
      .from('user_panels')
      .insert({
        user_id: user.id,
        server_id: serverId,
        ptero_user_id: pteroUserId,
        ptero_server_id: pteroServerId,
        username: username,
        email: panelEmail,
        password: panelPassword,
        login_url: pteroServer.domain,
        ram: ram,
        cpu: cpu,
        disk: disk,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error(`Failed to save panel: ${insertError.message}`);
    }

    // Step 4: Update user's panel count
    const { error: updateError } = await supabase.rpc('increment_panel_count', { _user_id: user.id });
    if (updateError) {
      console.log('Note: Failed to increment panel count:', updateError.message);
    }

    console.log('Panel created successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        panel: panelData,
        message: 'Panel berhasil dibuat di Pterodactyl!',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat panel';
    console.error('Error in create-panel:', errorMessage);
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
