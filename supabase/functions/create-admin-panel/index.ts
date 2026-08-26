import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body { username: string; serverId: string; }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    // Block suspended accounts
    const { data: suspProfile } = await supabase
      .from('profiles')
      .select('is_suspended')
      .eq('user_id', user.id)
      .maybeSingle();
    if (suspProfile?.is_suspended) {
      throw new Error('Akun kamu sedang di-suspend. Hubungi admin/support untuk info lebih lanjut.');
    }

    const { username, serverId }: Body = await req.json();
    if (!username || !serverId) throw new Error('username dan serverId wajib diisi');
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      throw new Error('Username 3-20 karakter: huruf/angka/underscore/strip.');
    }
    const RESERVED = ['admin', 'root', 'system', 'api', 'test', 'pterodactyl', 'panel'];
    if (RESERVED.includes(username.toLowerCase())) {
      throw new Error('Username ini tidak bisa digunakan.');
    }

    const { data: canData } = await supabase.rpc('can_create_admin_panel', { _user_id: user.id });
    if (!canData) throw new Error('Role kamu belum bisa membuat Admin Panel. Upgrade dulu.');

    const { data: existing } = await supabase
      .from('admin_panels')
      .select('id')
      .eq('user_id', user.id)
      .eq('server_id', serverId)
      .maybeSingle();
    if (existing) throw new Error('Kamu sudah punya Admin Panel di server ini (batas 1 per server).');

    const { data: serverData, error: serverError } = await supabase
      .from('pterodactyl_servers')
      .select('id, domain, plta_key, plta_share_key, pltc_key, egg_id, python_egg_id, nest_id, server_type, is_active')
      .eq('id', serverId)
      .single();
    if (serverError || !serverData) throw new Error('Server Pterodactyl tidak ditemukan');
    if (!serverData.is_active) throw new Error('Server sedang non-aktif.');
    if (!serverData.plta_key) throw new Error('Server belum punya PLTA key (hubungi admin).');

    const email = `${username}@gmail.com`;
    const rand = new Uint8Array(12);
    crypto.getRandomValues(rand);
    const password = Array.from(rand, b => b.toString(36).padStart(2, '0')).join('').slice(0, 16);

    const checkUser = await fetch(
      `${serverData.domain}/api/application/users?filter[username]=${encodeURIComponent(username)}`,
      { headers: { 'Authorization': `Bearer ${serverData.plta_key}`, 'Accept': 'application/json' } }
    );
    if (checkUser.ok) {
      const j = await checkUser.json();
      if (j.data && j.data.length > 0) throw new Error('Username sudah ada di Pterodactyl, pilih lain.');
    }
    const checkEmail = await fetch(
      `${serverData.domain}/api/application/users?filter[email]=${encodeURIComponent(email)}`,
      { headers: { 'Authorization': `Bearer ${serverData.plta_key}`, 'Accept': 'application/json' } }
    );
    if (checkEmail.ok) {
      const j = await checkEmail.json();
      if (j.data && j.data.length > 0) throw new Error('Email sudah ada di Pterodactyl, pilih username lain.');
    }

    const createRes = await fetch(`${serverData.domain}/api/application/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serverData.plta_key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email, username,
        first_name: username, last_name: 'Admin',
        password, root_admin: true,
      }),
    });
    if (!createRes.ok) {
      const t = await createRes.text();
      throw new Error(`Gagal buat root-admin di Pterodactyl: ${t}`);
    }
    const created = await createRes.json();
    const pteroUserId = created.attributes.id;

    // Key yang dibagikan ke pengguna (fallback ke key create bila belum diisi admin)
    const shareKey = serverData.plta_share_key || serverData.plta_key;

    const { data: apRow, error: insErr } = await supabase
      .from('admin_panels')
      .insert({
        user_id: user.id, server_id: serverId,
        ptero_user_id: pteroUserId, username, email, password,
        login_url: serverData.domain,
        plta_key: shareKey, pltc_key: serverData.pltc_key,
      })
      .select().single();
    if (insErr) throw new Error(`Gagal simpan admin panel: ${insErr.message}`);

    return new Response(JSON.stringify({
      success: true,
      panel: {
        ...apRow,
        nest_id: serverData.nest_id,
        egg_id_nodejs: serverData.egg_id,
        egg_id_python: serverData.python_egg_id,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('create-admin-panel error:', msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
