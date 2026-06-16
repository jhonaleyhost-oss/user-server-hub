import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  if (!panelId) return new Response('missing panel id', { status: 401, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { socket: client, response } = Deno.upgradeWebSocket(req);
  let upstream: WebSocket | null = null;
  const queue: string[] = [];
  let authed = false;
  const authTimer = setTimeout(() => closeBoth(client, upstream, 1008, 'bridge auth timeout'), 10_000);

  client.onmessage = async (ev) => {
    const data = typeof ev.data === 'string' ? ev.data : '';
    if (!data) return;
    if (!authed) {
      let msg: any;
      try { msg = JSON.parse(data); } catch { return closeBoth(client, upstream, 1008, 'bad bridge auth'); }
      const bridgeToken = msg?.event === 'auth' ? msg?.args?.[0] : null;
      const { data: cached } = await supabase
        .from('ptero_ws_token_cache')
        .select('token, socket, expires_at')
        .eq('panel_id', panelId)
        .maybeSingle();
      if (!cached?.token || !cached?.socket || cached.token !== bridgeToken || new Date(cached.expires_at).getTime() <= Date.now()) {
        return closeBoth(client, upstream, 1008, 'invalid bridge auth');
      }
      authed = true;
      clearTimeout(authTimer);
      queue.push(data);
      upstream = new WebSocket(cached.socket);
      upstream.onopen = () => {
        while (queue.length && upstream?.readyState === WebSocket.OPEN) upstream.send(queue.shift()!);
      };
      upstream.onmessage = (event) => {
        if (client.readyState === WebSocket.OPEN) client.send(event.data);
      };
      upstream.onclose = (event) => closeBoth(client, null, event.code || 1000, event.reason || 'upstream closed');
      upstream.onerror = () => closeBoth(client, upstream, 1011, 'upstream error');
      return;
    }
    if (upstream?.readyState === WebSocket.OPEN) upstream.send(data);
    else queue.push(data);
  };
  client.onclose = () => closeBoth(null, upstream);
  client.onerror = () => closeBoth(client, upstream, 1011, 'client error');

  return response;
});