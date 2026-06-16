import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache for WS tokens (per panel). Current Pterodactyl WS JWTs last ~15 min,
// so cache briefly and never let a 429 become a thrown Edge Function runtime error.
const TOKEN_TTL_MS = 8 * 60 * 1000;
const tokenCache = new Map<string, { token: string; socket: string; exp: number }>();
const throttleCache = new Map<string, number>();

const jsonResponse = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
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

    const { panelId, forceFresh } = await req.json();
    if (!panelId) throw new Error('panelId required');

    const { data: isAdminData } = await supabase.rpc('is_admin', { _user_id: user.id });
    const isAdmin = !!isAdminData;

    let q = supabase.from('user_panels').select(`
        id, user_id, ptero_identifier,
        pterodactyl_servers ( domain, pltc_key )
      `).eq('id', panelId);
    if (!isAdmin) q = q.eq('user_id', user.id);
    const { data: panel, error: pErr } = await q.single();
    if (pErr || !panel) throw new Error('Panel tidak ditemukan');
    const srv: any = panel.pterodactyl_servers;
    if (!srv?.pltc_key || !srv?.domain) throw new Error('Server config kosong');
    if (!panel.ptero_identifier) throw new Error('Identifier belum siap');

    const cacheKey = String(panel.id);
    const cached = tokenCache.get(cacheKey);
    if (!forceFresh && cached && cached.exp > Date.now()) {
      return jsonResponse({
        success: true, token: cached.token, socket: cached.socket, cached: true,
      });
    }

    const { data: durableCached } = await supabase
      .from('ptero_ws_token_cache')
      .select('token, socket, expires_at, throttled_until, last_error')
      .eq('panel_id', cacheKey)
      .maybeSingle();

    if (!forceFresh && durableCached?.token && durableCached?.socket && durableCached?.expires_at && new Date(durableCached.expires_at).getTime() > Date.now()) {
      tokenCache.set(cacheKey, { token: durableCached.token, socket: durableCached.socket, exp: new Date(durableCached.expires_at).getTime() });
      return jsonResponse({
        success: true, token: durableCached.token, socket: durableCached.socket, cached: true, durable: true,
      });
    }

    const durableThrottleUntil = durableCached?.throttled_until ? new Date(durableCached.throttled_until).getTime() : 0;
    if (!forceFresh && durableThrottleUntil > Date.now()) {
      return jsonResponse({
        success: false,
        status: 429,
        retryAfterMs: durableThrottleUntil - Date.now(),
        error: durableCached?.last_error || 'Pterodactyl sedang membatasi request token console. Tunggu sebentar lalu coba lagi.',
        fallback: true,
        durable: true,
      });
    }

    const throttledUntil = throttleCache.get(cacheKey) || 0;
    if (!forceFresh && throttledUntil > Date.now()) {
      return jsonResponse({
        success: false,
        status: 429,
        retryAfterMs: throttledUntil - Date.now(),
        error: 'Pterodactyl sedang membatasi request token console. Tunggu sebentar lalu coba lagi.',
        fallback: true,
      });
    }

    const resp = await fetch(`${srv.domain}/api/client/servers/${panel.ptero_identifier}/websocket`, {
      headers: {
        'Authorization': `Bearer ${srv.pltc_key}`,
        'Accept': 'application/json',
      },
    });
    const txt = await resp.text();
    if (!resp.ok) {
      // Serve stale cache on rate-limit if available
      if (resp.status === 429 && cached) {
        return jsonResponse({
          success: true, token: cached.token, socket: cached.socket, stale: true,
        });
      }
      if (resp.status === 429 && durableCached?.token && durableCached?.socket) {
        throttleCache.set(cacheKey, Date.now() + 120_000);
        await supabase.from('ptero_ws_token_cache').upsert({
          panel_id: cacheKey,
          token: durableCached.token,
          socket: durableCached.socket,
          expires_at: durableCached.expires_at,
          throttled_until: new Date(Date.now() + 120_000).toISOString(),
          last_error: 'Pterodactyl sedang membatasi request token console.',
        });
        return jsonResponse({
          success: true, token: durableCached.token, socket: durableCached.socket, stale: true, durable: true,
        });
      }
      if (resp.status === 429) {
        throttleCache.set(cacheKey, Date.now() + 120_000);
        await supabase.from('ptero_ws_token_cache').upsert({
          panel_id: cacheKey,
          throttled_until: new Date(Date.now() + 120_000).toISOString(),
          last_error: 'Pterodactyl sedang membatasi request token console. Tunggu ±2 menit tanpa refresh halaman server.',
        });
        return jsonResponse({
          success: false,
          status: 429,
          retryAfterMs: 120_000,
          error: 'Pterodactyl sedang membatasi request token console. Tunggu ±2 menit tanpa refresh halaman server.',
          fallback: true,
        });
      }
      return jsonResponse({ success: false, status: resp.status, error: `WS token error ${resp.status}: ${txt.slice(0,200)}` });
    }
    const j = JSON.parse(txt);
    const tok = j?.data?.token; const sock = j?.data?.socket;
    if (tok && sock) {
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
      tokenCache.set(cacheKey, { token: tok, socket: sock, exp: Date.now() + TOKEN_TTL_MS });
      await supabase.from('ptero_ws_token_cache').upsert({
        panel_id: cacheKey,
        token: tok,
        socket: sock,
        expires_at: expiresAt,
        throttled_until: null,
        last_error: null,
      });
    }
    return jsonResponse({
      success: true,
      token: tok,
      socket: sock,
    });
  } catch (e: any) {
    return jsonResponse({ success: false, error: e?.message || 'error' });
  }
});