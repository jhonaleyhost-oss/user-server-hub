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
  panelType?: 'nodejs' | 'python';
  subUserId?: string;
  reusePteroUserId?: number;
}

interface PterodactylServer {
  id: string;
  domain: string;
  plta_key: string;
  pltc_key: string;
  egg_id: number;
  python_egg_id: number;
  nest_id: number;
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

    console.log('User authenticated');

    // Parse request body
    const { username, serverId, ram, cpu, disk, panelType, subUserId, reusePteroUserId }: CreatePanelRequest = await req.json();
    const type: 'nodejs' | 'python' = panelType === 'python' ? 'python' : 'nodejs';
    
    console.log('Panel creation request received');

    if (!username || !serverId) {
      throw new Error('Missing required fields: username and serverId');
    }

    // Validate username format
    const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!USERNAME_PATTERN.test(username)) {
      throw new Error('Username harus 3-20 karakter: huruf, angka, underscore, atau strip saja.');
    }

    // Check reserved names
    const RESERVED_NAMES = ['admin', 'root', 'system', 'api', 'test', 'pterodactyl', 'panel'];
    if (RESERVED_NAMES.includes(username.toLowerCase())) {
      throw new Error('Username ini tidak bisa digunakan, silakan pilih yang lain.');
    }
    // Server-side role enforcement
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const userRole = roleData?.role || 'free';

    if (userRole === 'free' && !subUserId && !reusePteroUserId) {
      // Check panel count limit
      const { count: existingPanels } = await supabase
        .from('user_panels')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if ((existingPanels || 0) >= 1) {
        throw new Error('Batas panel tercapai. Upgrade ke Premium untuk lebih banyak panel.');
      }

      // Enforce resource limits (0 = unlimited in Pterodactyl, block it)
      if (ram <= 0 || cpu <= 0 || disk <= 0) {
        throw new Error('Free user tidak bisa menggunakan resource unlimited.');
      }
      if (ram > 1024 || cpu > 40) {
        throw new Error('Free user: maksimal 1GB RAM dan 40% CPU.');
      }

      // Check server type
      const { data: serverCheck } = await supabase
        .from('pterodactyl_servers')
        .select('server_type')
        .eq('id', serverId)
        .single();

      if (serverCheck?.server_type === 'private') {
        throw new Error('Free user tidak bisa menggunakan server private.');
      }
    }

    // Get Pterodactyl server details
    const { data: serverData, error: serverError } = await supabase
      .from('pterodactyl_servers')
      .select('id, domain, plta_key, pltc_key, egg_id, python_egg_id, nest_id, location_id')
      .eq('id', serverId)
      .single();

    if (serverError || !serverData) {
      console.error('Server fetch error:', serverError);
      throw new Error('Pterodactyl server not found');
    }

    const pteroServer: PterodactylServer = serverData;

    // ==========================================================
    // Branch: sub-user mode → create server for an existing user
    // in the caller's admin panel using the admin panel's PLTA.
    // ==========================================================
    if (subUserId) {
      const { data: subUser, error: suErr } = await supabase
        .from('admin_panel_subusers')
        .select('id, ptero_user_id, username, admin_panel_id')
        .eq('id', subUserId)
        .single();
      if (suErr || !subUser) throw new Error('Sub-user tidak ditemukan');

      const { data: adminPanel, error: apErr } = await supabase
        .from('admin_panels')
        .select('id, user_id, server_id, plta_key, login_url')
        .eq('id', (subUser as any).admin_panel_id)
        .single();
      if (apErr || !adminPanel) throw new Error('Admin panel tidak ditemukan');
      if ((adminPanel as any).user_id !== user.id) {
        throw new Error('Kamu tidak memiliki akses ke sub-user tersebut.');
      }
      if ((adminPanel as any).server_id !== serverId) {
        throw new Error('Server tidak cocok dengan admin panel sub-user.');
      }
      const adminPlta = (adminPanel as any).plta_key;
      if (!adminPlta) throw new Error('Admin panel belum punya PLTA key.');

      const eggId2 = type === 'python' ? pteroServer.python_egg_id : pteroServer.egg_id;
      const dockerImage2 = type === 'python'
        ? 'ghcr.io/parkervcp/yolks:python_3.10'
        : 'ghcr.io/parkervcp/yolks:nodejs_18';
      const startupCmd2 = type === 'python'
        ? 'if [[ -d .git ]] && [[ "{{AUTO_UPDATE}}" == "1" ]]; then git pull; fi; if [[ ! -z "{{PY_PACKAGES}}" ]]; then pip install -U --prefix .local {{PY_PACKAGES}}; fi; if [[ -f /home/container/${REQUIREMENTS_FILE} ]]; then pip install -U --prefix .local -r ${REQUIREMENTS_FILE}; fi; /usr/local/bin/python /home/container/{{PY_FILE}}'
        : 'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; if [[ ! -z ${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then vars=$(echo ${CUSTOM_ENVIRONMENT_VARIABLES} | tr ";" "\n"); for line in $vars; do export $line; done fi; /usr/local/bin/${CMD_RUN};';
      const envVars2 = type === 'python'
        ? { GIT_ADDRESS: '', BRANCH: '', AUTO_UPDATE: '0', PY_FILE: 'app.py', PY_PACKAGES: '', USERNAME: '', ACCESS_TOKEN: '', REQUIREMENTS_FILE: 'requirements.txt', USER_UPLOAD: '0' }
        : { INST: 'npm', USER_UPLOAD: '0', AUTO_UPDATE: '0', CMD_RUN: 'npm start' };

      const createSubServerRes = await fetch(`${pteroServer.domain}/api/application/servers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminPlta}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name: username,
          user: (subUser as any).ptero_user_id,
          egg: eggId2,
          docker_image: dockerImage2,
          startup: startupCmd2,
          environment: envVars2,
          limits: {
            memory: ram === 0 ? 0 : ram,
            swap: 0,
            disk: disk === 0 ? 0 : disk,
            io: 500,
            cpu: cpu === 0 ? 0 : cpu,
          },
          feature_limits: { databases: 0, backups: 1, allocations: 1 },
          allocation: { default: null },
          deploy: {
            locations: [pteroServer.location_id],
            dedicated_ip: false,
            port_range: [],
          },
        }),
      });
      if (!createSubServerRes.ok) {
        const errText = await createSubServerRes.text();
        throw new Error(`Gagal buat server sub-user: ${errText}`);
      }
      const subServerResult = await createSubServerRes.json();
      const subPteroServerId = subServerResult.attributes.id;

      const { data: apServerRow, error: apInsErr } = await supabase
        .from('admin_panel_servers')
        .insert({
          admin_panel_id: (adminPanel as any).id,
          subuser_id: (subUser as any).id,
          name: username,
          ptero_server_id: subPteroServerId,
          ram,
          cpu,
          disk,
          panel_type: type,
        })
        .select()
        .single();
      if (apInsErr) throw new Error(`Gagal simpan server sub-user: ${apInsErr.message}`);

      return new Response(
        JSON.stringify({
          success: true,
          subUser: true,
          panel: apServerRow,
          message: `Server berhasil dibuat untuk sub-user ${(subUser as any).username}!`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Pick egg + docker + startup + env based on panel type
    const eggId = type === 'python' ? pteroServer.python_egg_id : pteroServer.egg_id;
    const dockerImage = type === 'python'
      ? 'ghcr.io/parkervcp/yolks:python_3.10'
      : 'ghcr.io/parkervcp/yolks:nodejs_18';
    const startupCmd = type === 'python'
      ? 'if [[ -d .git ]] && [[ "{{AUTO_UPDATE}}" == "1" ]]; then git pull; fi; if [[ ! -z "{{PY_PACKAGES}}" ]]; then pip install -U --prefix .local {{PY_PACKAGES}}; fi; if [[ -f /home/container/${REQUIREMENTS_FILE} ]]; then pip install -U --prefix .local -r ${REQUIREMENTS_FILE}; fi; /usr/local/bin/python /home/container/{{PY_FILE}}'
      : 'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; if [[ ! -z ${CUSTOM_ENVIRONMENT_VARIABLES} ]]; then vars=$(echo ${CUSTOM_ENVIRONMENT_VARIABLES} | tr ";" "\n"); for line in $vars; do export $line; done fi; /usr/local/bin/${CMD_RUN};';
    const envVars = type === 'python'
      ? {
          GIT_ADDRESS: '',
          BRANCH: '',
          AUTO_UPDATE: '0',
          PY_FILE: 'app.py',
          PY_PACKAGES: '',
          USERNAME: '',
          ACCESS_TOKEN: '',
          REQUIREMENTS_FILE: 'requirements.txt',
          USER_UPLOAD: '0',
        }
      : {
          INST: 'npm',
          USER_UPLOAD: '0',
          AUTO_UPDATE: '0',
          CMD_RUN: 'npm start',
        };

    const panelEmail = `${username}@gmail.com`;
    
    // Generate secure random password
    const randomBytes = new Uint8Array(12);
    crypto.getRandomValues(randomBytes);
    const panelPassword = Array.from(randomBytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);

    // Step 0: Check if username or email already exists in Pterodactyl
    console.log('Checking if username/email already exists...');
    
    // Check by username
    const checkUsernameResponse = await fetch(
      `${pteroServer.domain}/api/application/users?filter[username]=${encodeURIComponent(username)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${pteroServer.plta_key}`,
          'Accept': 'application/json',
        },
      }
    );

    if (checkUsernameResponse.ok) {
      const checkData = await checkUsernameResponse.json();
      if (checkData.data && checkData.data.length > 0) {
        console.log('Username already exists in Pterodactyl');
        throw new Error('Username sudah ada, gunakan username lain.');
      }
    }

    // Check by email
    const checkEmailResponse = await fetch(
      `${pteroServer.domain}/api/application/users?filter[email]=${encodeURIComponent(panelEmail)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${pteroServer.plta_key}`,
          'Accept': 'application/json',
        },
      }
    );

    if (checkEmailResponse.ok) {
      const checkEmailData = await checkEmailResponse.json();
      if (checkEmailData.data && checkEmailData.data.length > 0) {
        console.log('Email already exists in Pterodactyl');
        throw new Error('Username sudah ada, gunakan username lain.');
      }
    }

    console.log('Username and email are available, proceeding...');

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
      console.error('Create user error:', createUserResponse.status, errorText);
      throw new Error(`Gagal membuat user di Pterodactyl: ${errorText}`);
    }

    const userResult = await createUserResponse.json();
    pteroUserId = userResult.attributes.id;
    console.log('Created Pterodactyl user with ID:', pteroUserId);

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
        egg: eggId,
        docker_image: dockerImage,
        startup: startupCmd,
        environment: envVars,
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
        panel_type: type,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw new Error(`Failed to save panel: ${insertError.message}`);
    }

    // Panel count is now auto-incremented by database trigger

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
