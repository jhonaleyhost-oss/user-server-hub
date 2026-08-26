import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const fingerprint =
      typeof body?.fingerprint === 'string' && body.fingerprint.length <= 128
        ? body.fingerprint
        : null;

    const fwd = req.headers.get('x-forwarded-for');
    const ip =
      (fwd ? fwd.split(',')[0].trim() : null) ||
      req.headers.get('cf-connecting-ip') ||
      null;

    const filters: string[] = [];
    if (fingerprint) filters.push(`device_fingerprint.eq.${fingerprint}`);
    if (ip) filters.push(`ip_address.eq.${ip}`);
    if (filters.length === 0) return json({ blocked: false });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Hanya blokir yang berasal dari suspend akun (source='suspend').
    // Blokir 'archive' (reset perangkat) hanya berlaku untuk pendaftaran.
    const { data, error } = await supabase
      .from('blocked_devices')
      .select('id, reason')
      .eq('source', 'suspend')
      .or(filters.join(','))
      .limit(1);

    if (error) {
      console.error('check-device query error:', error);
      return json({ blocked: false });
    }

    return json({
      blocked: (data?.length ?? 0) > 0,
      reason: data?.[0]?.reason ?? null,
    });
  } catch (err) {
    console.error('check-device error:', err);
    // Fail-open: jangan kunci semua orang kalau ada error
    return json({ blocked: false });
  }
});
