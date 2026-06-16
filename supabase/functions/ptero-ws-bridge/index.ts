import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const closeBoth = (a?: WebSocket | null, b?: any, code = 1000, reason = 'closed') => {
  try { if (a && a.readyState < WebSocket.CLOSING) a.close(code, reason); } catch {}
  try { if (b && b.readyState < WebSocket.CLOSING) b.close(code, reason); } catch {}
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response(JSON.stringify({ success: false, error: 'websocket required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const panelId = url.searchParams.get('panelId');
  const authToken = url.searchParams.get('auth');

  if (!panelId || !authToken) return new Response('missing bridge auth', { status: 401, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
  if (authError || !user) return new Response('unauthorized', { status: 401, headers: corsHeaders });

  const { data: isAdminData } = await supabase.rpc('is_admin', { _user_id: user.id });
  const isAdmin = !!isAdminData;
  let q = supabase.from('user_panels').select(`
      id, user_id, ptero_identifier,
      pterodactyl_servers ( domain, pltc_key )
    `).eq('id', panelId);
  if (!isAdmin) q = q.eq('user_id', user.id);
  const { data: panel, error: pErr } = await q.single();
  if (pErr || !panel) return new Response('panel not found', { status: 404, headers: corsHeaders });
  const srv: any = panel.pterodactyl_servers;
  if (!srv?.domain || !srv?.pltc_key || !panel.ptero_identifier) {
    return new Response('server config missing', { status: 400, headers: corsHeaders });
  }

  const tokenResp = await fetch(`${String(srv.domain).replace(/\/+$/, '')}/api/client/servers/${panel.ptero_identifier}/websocket`, {
    headers: { Authorization: `Bearer ${srv.pltc_key}`, Accept: 'application/json' },
  });
  const tokenText = await tokenResp.text();
  if (!tokenResp.ok) {
    return new Response(`ws token failed ${tokenResp.status}: ${tokenText.slice(0, 200)}`, { status: 502, headers: corsHeaders });
  }
  const tokenJson = JSON.parse(tokenText);
  const upstreamToken = tokenJson?.data?.token;
  const upstreamSocket = tokenJson?.data?.socket;
  if (!upstreamToken || !upstreamSocket) return new Response('ws token invalid', { status: 502, headers: corsHeaders });

  const { socket: client, response } = Deno.upgradeWebSocket(req);
  let upstream: any = null;
  const queue: string[] = [];
  let releaseLifetime = () => {};
  const lifetime = new Promise<void>((resolve) => { releaseLifetime = resolve; });
  (globalThis as any).EdgeRuntime?.waitUntil(lifetime);

  const origin = String(srv.domain).replace(/\/+$/, '');
  const upstreamHost = (() => {
    try { return new URL(upstreamSocket).host; } catch { return 'invalid-socket-url'; }
  })();
  console.log('ptero bridge upstream connect', { panelId, upstreamHost, origin });
  upstream = new WebSocket(upstreamSocket, origin ? { headers: { Origin: origin } } as any : undefined);
  upstream.onopen = () => {
    console.log('ptero bridge upstream open', { panelId, upstreamHost });
    upstream.send(JSON.stringify({ event: 'auth', args: [upstreamToken] }));
    while (queue.length && upstream?.readyState === WebSocket.OPEN) upstream.send(queue.shift()!);
  };
  upstream.onmessage = (event: MessageEvent) => {
    const preview = typeof event.data === 'string' ? event.data.slice(0, 80) : '[binary]';
    console.log('ptero bridge upstream message', { panelId, preview });
    if (client.readyState === WebSocket.OPEN) client.send(event.data);
  };
  upstream.onclose = (event: CloseEvent) => {
    console.log('ptero bridge upstream close', { panelId, code: event.code, reason: event.reason });
    closeBoth(client, null, event.code || 1000, event.reason || 'upstream closed');
    releaseLifetime();
  };
  upstream.onerror = (event: any) => {
    console.error('ptero bridge upstream error', {
      type: event?.type,
      message: event?.message,
      error: event?.error?.message || String(event?.error || ''),
      upstreamHost,
      origin,
    });
    closeBoth(client, upstream, 1011, 'upstream error');
    releaseLifetime();
  };

  client.onmessage = (ev) => {
    const data = typeof ev.data === 'string' ? ev.data : '';
    if (!data) return;
    if (upstream?.readyState === WebSocket.OPEN) upstream.send(data);
    else queue.push(data);
  };
  client.onopen = () => console.log('ptero bridge client open', { panelId });
  client.onclose = (event) => { console.log('ptero bridge client close', { panelId, code: event.code, reason: event.reason }); closeBoth(null, upstream); releaseLifetime(); };
  client.onerror = () => { console.error('ptero bridge client error', { panelId }); closeBoth(client, upstream, 1011, 'client error'); releaseLifetime(); };

  return response;
});