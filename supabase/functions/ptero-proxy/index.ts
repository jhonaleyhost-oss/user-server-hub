import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Whitelist: only allow paths under /api/client/servers/{identifier}/...
function safePath(p: string): string {
  // strip leading slash
  let s = p.replace(/^\/+/, '');
  // disallow path traversal
  if (s.includes('..')) throw new Error('bad path');
  return s;
}

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

    const body = await req.json();
    const { panelId, path, method, body: payload, query } = body as {
      panelId: string; path: string; method?: string; body?: any; query?: Record<string,string>;
    };
    if (!panelId || !path) throw new Error('panelId & path required');

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
    if (!panel.ptero_identifier) throw new Error('Server identifier belum di-resolve, panggil panel-session dulu');

    const cleanPath = safePath(path);
    let url = `${srv.domain}/api/client/servers/${panel.ptero_identifier}/${cleanPath}`;
    if (query && Object.keys(query).length) {
      const qs = new URLSearchParams(query).toString();
      url += (url.includes('?') ? '&' : '?') + qs;
    }

    const m = (method || 'GET').toUpperCase();
    const init: RequestInit = {
      method: m,
      headers: {
        'Authorization': `Bearer ${srv.pltc_key}`,
        'Accept': 'application/json',
        ...(payload != null ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(payload != null && m !== 'GET' && m !== 'HEAD' ? { body: typeof payload === 'string' ? payload : JSON.stringify(payload) } : {}),
    };

    const resp = await fetch(url, init);
    const text = await resp.text();
    // try parse JSON, fall back to text
    let data: any = text;
    try { data = JSON.parse(text); } catch {}

    return new Response(JSON.stringify({
      success: resp.ok,
      status: resp.status,
      data,
    }), {
      status: 200, // always 200 from edge; client checks success
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, status: 500, error: e?.message || 'error' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});