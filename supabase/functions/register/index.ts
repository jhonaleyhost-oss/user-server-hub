import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // max 3 attempts per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return true;
  }
  return false;
}

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 60000);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, fullName, fingerprint } = await req.json();

    if (!email || !password) {
      throw new Error('Email dan password wajib diisi.');
    }

    // Get client IP from headers
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      'unknown';

    console.log('Registration attempt from IP:', clientIp, 'Fingerprint:', fingerprint || 'none');

    // Rate limit check
    if (clientIp !== 'unknown' && isRateLimited(clientIp)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Terlalu banyak percobaan. Coba lagi dalam 1 menit.',
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if full name already taken (case-insensitive) to avoid opaque 500 from unique constraint
    if (fullName && fullName.trim().length > 0) {
      const { data: nameTaken } = await supabase
        .from('profiles')
        .select('id')
        .ilike('full_name', fullName.trim())
        .limit(1);
      if (nameTaken && nameTaken.length > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Nama "${fullName}" sudah dipakai. Silakan gunakan nama lain.`,
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Check if email already registered
    {
      const { data: emailTaken } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .limit(1);
      if (emailTaken && emailTaken.length > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Email ini sudah terdaftar. Silakan login atau gunakan email lain.',
          }),
          {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Check if IP already used for registration
    if (clientIp !== 'unknown') {
      const { data: ipProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('ip_address', clientIp)
        .limit(1);

      const { data: ipBlocked } = await supabase
        .from('blocked_devices')
        .select('id')
        .eq('ip_address', clientIp)
        .limit(1);

      if ((ipProfiles && ipProfiles.length > 0) || (ipBlocked && ipBlocked.length > 0)) {
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

    // Check if device fingerprint already used
    if (fingerprint) {
      const { data: fpProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('device_fingerprint', fingerprint)
        .limit(1);

      const { data: fpBlocked } = await supabase
        .from('blocked_devices')
        .select('id')
        .eq('device_fingerprint', fingerprint)
        .limit(1);

      if ((fpProfiles && fpProfiles.length > 0) || (fpBlocked && fpBlocked.length > 0)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Perangkat ini sudah pernah digunakan untuk mendaftar. Hanya 1 akun per perangkat.',
          }),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Create user via Supabase Auth
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

    // Store IP and fingerprint in profile (with retry for trigger race condition)
    if (authData.user) {
      const updateData: Record<string, string> = {};
      if (clientIp !== 'unknown') updateData.ip_address = clientIp;
      if (fingerprint) updateData.device_fingerprint = fingerprint;

      if (Object.keys(updateData).length > 0) {
        let updated = false;
        for (let attempt = 0; attempt < 5; attempt++) {
          const { data: updatedRows, error: updateError } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('user_id', authData.user.id)
            .select('id');

          if (updateError) {
            console.error(`Attempt ${attempt + 1} failed:`, updateError);
          } else if (updatedRows && updatedRows.length > 0) {
            updated = true;
            console.log('Device info stored successfully on attempt', attempt + 1);
            break;
          }
          // Profile not yet created by trigger, wait and retry
          await new Promise(r => setTimeout(r, 500));
        }
        if (!updated) {
          console.error('Failed to store device info after all retries');
        }
      }
    }

    console.log('User registered successfully with IP + fingerprint tracking');

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
