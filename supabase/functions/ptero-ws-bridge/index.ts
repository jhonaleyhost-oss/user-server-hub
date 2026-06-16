import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sec-websocket-protocol',
};

const closeBoth = (a?: WebSocket | null, b?: WebSocket | null, code = 1000, reason = 'closed') => {
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
  const protocols = (req.headers.get('sec-websocket-protocol') || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const token = protocols.find((p) => p !== 'ptero-bridge');

  if (!panelId || !token) return new Response('missing bridge auth', { status: 401, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: cached } = await supabase
    .from('ptero_ws_token_cache')
    .select('token, socket, expires_at')
    .eq('panel_id', panelId)
    .maybeSingle();

  if (!cached?.token || !cached?.socket || cached.token !== token || new Date(cached.expires_at).getTime() <= Date.now()) {
    return new Response('invalid or expired bridge token', { status: 401, headers: corsHeaders });
  }

  const { socket: client, response } = Deno.upgradeWebSocket(req, { protocol: 'ptero-bridge' });
  let upstream: WebSocket | null = null;
  const queue: string[] = [];

  try {
    upstream = new WebSocket(cached.socket);
  } catch {
    client.close(1011, 'upstream create failed');
    return response;
  }

  client.onmessage = (ev) => {
    const data = typeof ev.data === 'string' ? ev.data : '';
    if (!data) return;
    if (upstream?.readyState === WebSocket.OPEN) upstream.send(data);
    else queue.push(data);
  };
  client.onclose = () => closeBoth(null, upstream);
  client.onerror = () => closeBoth(client, upstream, 1011, 'client error');

  upstream.onopen = () => {
    while (queue.length && upstream?.readyState === WebSocket.OPEN) upstream.send(queue.shift()!);
  };
  upstream.onmessage = (ev) => {
    if (client.readyState === WebSocket.OPEN) client.send(ev.data);
  };
  upstream.onclose = (ev) => closeBoth(client, null, ev.code || 1000, ev.reason || 'upstream closed');
  upstream.onerror = () => closeBoth(client, upstream, 1011, 'upstream error');

  return response;
});