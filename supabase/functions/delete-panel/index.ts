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

  const logs: string[] = [];
  const log = (msg: string) => {
    const line = `[${new Date().toISOString().split('T')[1].split('.')[0]}] ${msg}`;
    logs.push(line);
    console.log(line);
  };

  // Helper: fetch with timeout — critical so dead servers don't hang the function
  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 5000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  };

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
      log(`Auth error: ${authError?.message}`);
      throw new Error('Unauthorized');
    }

    log(`User terverifikasi: ${user.id}`);

    // Check if user is admin (admins can delete any panel)
    const { data: isAdminData } = await supabase.rpc('is_admin', { _user_id: user.id });
    const isAdmin = !!isAdminData;

    // Parse request body
    const { panelId }: DeletePanelRequest = await req.json();
    
    log(`Permintaan hapus panel: ${panelId}`);

    if (!panelId) {
      throw new Error('Missing required field: panelId');
    }

    // Get panel details (with server info for API keys)
    let panelQuery = supabase
      .from('user_panels')
      .select(`
        *,
        pterodactyl_servers (
          id,
          domain,
          plta_key
        )
      `)
      .eq('id', panelId);

    if (!isAdmin) {
      panelQuery = panelQuery.eq('user_id', user.id);
    }

    const { data: panelData, error: panelError } = await panelQuery.single();

    if (panelError || !panelData) {
      log(`Panel fetch error: ${panelError?.message}`);
      throw new Error('Panel tidak ditemukan atau Anda tidak memiliki akses');
    }

    log(`Panel ditemukan: ${panelData.username} (ptero_server_id=${panelData.ptero_server_id}, ptero_user_id=${panelData.ptero_user_id})`);

    const pteroServer = panelData.pterodactyl_servers;

    // Step 0: Quick health check (2s) so we skip remote calls on dead servers
    let serverAlive = false;
    if (pteroServer?.domain) {
      log(`Cek status server ${pteroServer.domain}...`);
      try {
        const ping = await fetchWithTimeout(
          `${pteroServer.domain}/api/application/servers?per_page=1`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${pteroServer.plta_key}`,
              'Accept': 'application/json',
            },
          },
          2500
        );
        serverAlive = ping.ok;
        log(serverAlive ? `Server online (HTTP ${ping.status})` : `Server merespon HTTP ${ping.status} — lewati panggilan API`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        log(`Server tidak merespon (${msg}) — lewati panggilan API, lanjut hapus dari database`);
        serverAlive = false;
      }
    } else {
      log('Panel tidak punya server terkait — langsung hapus dari database');
    }

    // Step 1: Delete server in Pterodactyl (only if server alive)
    if (serverAlive && panelData.ptero_server_id) {
      log(`Menghapus server Pterodactyl id=${panelData.ptero_server_id}...`);
      try {
        const resp = await fetchWithTimeout(
          `${pteroServer.domain}/api/application/servers/${panelData.ptero_server_id}/force`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${pteroServer.plta_key}`,
              'Accept': 'application/json',
            },
          },
          5000
        );
        if (resp.ok || resp.status === 404) {
          log(`Server Pterodactyl terhapus (HTTP ${resp.status})`);
        } else {
          const t = await resp.text().catch(() => '');
          log(`Gagal hapus server Pterodactyl HTTP ${resp.status}: ${t.slice(0, 200)}`);
        }
      } catch (e) {
        log(`Timeout/error hapus server Pterodactyl: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else if (panelData.ptero_server_id) {
      log('Lewati hapus server Pterodactyl karena server offline');
    }

    // Step 2: Delete user in Pterodactyl if no other panels use it
    if (serverAlive && panelData.ptero_user_id) {
      const { count } = await supabase
        .from('user_panels')
        .select('*', { count: 'exact', head: true })
        .eq('ptero_user_id', panelData.ptero_user_id)
        .neq('id', panelId);

      if (count === 0) {
        log(`Menghapus user Pterodactyl id=${panelData.ptero_user_id}...`);
        try {
          const resp = await fetchWithTimeout(
            `${pteroServer.domain}/api/application/users/${panelData.ptero_user_id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${pteroServer.plta_key}`,
                'Accept': 'application/json',
              },
            },
            5000
          );
          if (resp.ok || resp.status === 404) {
            log(`User Pterodactyl terhapus (HTTP ${resp.status})`);
          } else {
            const t = await resp.text().catch(() => '');
            log(`Gagal hapus user Pterodactyl HTTP ${resp.status}: ${t.slice(0, 200)}`);
          }
        } catch (e) {
          log(`Timeout/error hapus user Pterodactyl: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        log(`Skip hapus user Pterodactyl — masih dipakai ${count} panel lain`);
      }
    } else if (panelData.ptero_user_id) {
      log('Lewati hapus user Pterodactyl karena server offline');
    }

    // Step 3: Delete from our database
    log('Menghapus panel dari database...');
    const { error: deleteError } = await supabase
      .from('user_panels')
      .delete()
      .eq('id', panelId);

    if (deleteError) {
      log(`DB delete error: ${deleteError.message}`);
      throw new Error(`Failed to delete panel from database: ${deleteError.message}`);
    }

    log('Panel berhasil dihapus dari database');

    // Notify the owner when an admin deletes someone else's panel
    if (isAdmin && panelData.user_id && panelData.user_id !== user.id) {
      const { error: notifErr } = await supabase.from('notifications').insert({
        title: 'Panel Dihapus',
        body: `Panel "${panelData.username}" telah dihapus oleh admin.`,
        audience: 'all',
        target_user_id: panelData.user_id,
        created_by: user.id,
        link_url: '/dashboard',
      });
      if (notifErr) log(`Gagal membuat notifikasi: ${notifErr.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: serverAlive
          ? 'Panel berhasil dihapus dari Pterodactyl dan database!'
          : 'Panel berhasil dihapus dari database (server Pterodactyl offline, dilewati).',
        serverAlive,
        logs,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus panel';
    log(`ERROR: ${errorMessage}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        logs,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
