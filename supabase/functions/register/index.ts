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
    const { email, password, fullName } = await req.json();

    if (!email || !password) {
      throw new Error('Email dan password wajib diisi.');
    }

    // Get client IP from headers
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      'unknown';

    console.log('Registration attempt from IP:', clientIp);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if IP already used for registration
    if (clientIp !== 'unknown') {
      const { data: existingProfiles, error: ipCheckError } = await supabase
        .from('profiles')
        .select('id')
        .eq('ip_address', clientIp)
        .limit(1);

      if (ipCheckError) {
        console.error('IP check error:', ipCheckError);
      }

      if (existingProfiles && existingProfiles.length > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Perangkat/jaringan ini sudah pernah digunakan untuk mendaftar. Hanya 1 akun per perangkat.',
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Create user via Supabase Auth
    const redirectUrl = req.headers.get('origin') || 'https://jhonaleycpanel.lovable.app';
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || null,
      },
    });

    if (authError) {
      console.error('Auth error:', authError);
      throw new Error(authError.message);
    }

    // Store IP address in profile
    if (authData.user && clientIp !== 'unknown') {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ ip_address: clientIp })
        .eq('user_id', authData.user.id);

      if (updateError) {
        console.error('Failed to store IP:', updateError);
      }
    }

    console.log('User registered successfully with IP tracking');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Akun berhasil dibuat. Silakan login.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat mendaftar';
    console.error('Register error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
