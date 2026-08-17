import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServerPayload {
  action: 'create' | 'update' | 'delete';
  id?: string;
  name?: string;
  domain?: string;
  plta_key?: string;
  plta_share_key?: string;
  pltc_key?: string;
  server_type?: 'public' | 'private';
  location_id?: number;
  egg_id?: number;
  python_egg_id?: number;
  nest_id?: number;
  is_active?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Admin check
    const { data: isAdminData } = await supabase.rpc('is_admin', { _user_id: user.id });
    if (!isAdminData) throw new Error('Forbidden: admin only');

    const body: ServerPayload = await req.json();
    const { action } = body;

    if (action === 'delete') {
      if (!body.id) throw new Error('Missing id');
      const { error } = await supabase.from('pterodactyl_servers').delete().eq('id', body.id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: Record<string, unknown> = {};
    const fields = ['name','domain','server_type','location_id','egg_id','python_egg_id','nest_id','is_active'] as const;
    for (const f of fields) {
      if (body[f] !== undefined) payload[f] = body[f];
    }
    // Only set keys when provided (non-empty), so admin can edit without re-typing keys
    if (body.plta_key && body.plta_key.trim().length > 0) payload.plta_key = body.plta_key.trim();
    if (body.plta_share_key && body.plta_share_key.trim().length > 0) payload.plta_share_key = body.plta_share_key.trim();
    if (body.pltc_key && body.pltc_key.trim().length > 0) payload.pltc_key = body.pltc_key.trim();

    if (action === 'create') {
      if (!payload.plta_key || !payload.pltc_key) throw new Error('plta_key dan pltc_key wajib diisi saat membuat server baru');
      const { error } = await supabase.from('pterodactyl_servers').insert(payload);
      if (error) throw error;
    } else if (action === 'update') {
      if (!body.id) throw new Error('Missing id');
      const { error } = await supabase.from('pterodactyl_servers').update(payload).eq('id', body.id);
      if (error) throw error;
    } else {
      throw new Error('Invalid action');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});