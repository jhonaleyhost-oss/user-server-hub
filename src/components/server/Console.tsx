import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Square, RotateCcw, Zap, Send } from 'lucide-react';
import type { ServerStats } from './StatsCards';
import { usePteroProxy } from '@/hooks/usePteroProxy';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  panelId: string;
  onStats?: (s: ServerStats) => void;
  onState?: (s: string) => void;
}

type WsTokenResp = {
  success: boolean;
  token?: string;
  socket?: string;
  error?: string;
  status?: number;
  retryAfterMs?: number;
};

// Shared caches across all Console instances (StrictMode + tab switches)
const WS_TOKEN_TTL_MS = 8 * 60 * 1000;
const wsTokenCache = new Map<string, { token: string; socket: string; exp: number }>();
const wsCooldown = new Map<string, number>();
const wsInflight = new Map<string, Promise<WsTokenResp>>();
const STATS_REST_MS = 5000;

export default function ServerConsole({ panelId, onStats, onState }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [cmd, setCmd] = useState('');
  const { call } = usePteroProxy(panelId);

  const onStatsRef = useRef(onStats);
  const onStateRef = useRef(onState);
  useEffect(() => { onStatsRef.current = onStats; }, [onStats]);
  useEffect(() => { onStateRef.current = onState; }, [onState]);

  // init xterm
  useEffect(() => {
    if (!containerRef.current) return;
    const term = new XTerm({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 12,
      theme: { background: '#000000', foreground: '#e5e7eb', cursor: '#a78bfa' },
      cursorBlink: true,
      convertEol: true,
      scrollback: 3000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    setTimeout(() => fit.fit(), 50);
    termRef.current = term;
    fitRef.current = fit;

    const onResize = () => { try { fit.fit(); } catch {} };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  // Hybrid: WebSocket untuk live console + stats, REST fallback untuk stats kalau WS down
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let statsRestTimer: any = null;
    let wsStatsTimer: any = null;

    const writeLine = (txt: string) => termRef.current?.writeln(txt);

    const pollStatsRest = async () => {
      if (cancelled) return;
      // Skip REST polling kalau WS aktif (biar nggak dobel)
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      const r = await call<any>('resources');
      if (cancelled || !r.success) return;
      const a = r.data?.attributes;
      const res = a?.resources || {};
      onStatsRef.current?.({
        state: a?.current_state,
        cpu_absolute: res.cpu_absolute,
        memory_bytes: res.memory_bytes,
        disk_bytes: res.disk_bytes,
        network: { rx_bytes: res.network_rx_bytes, tx_bytes: res.network_tx_bytes },
        uptime: res.uptime,
      });
      if (a?.current_state) onStateRef.current?.(a.current_state);
    };

    const fetchToken = async (forceFresh = false): Promise<WsTokenResp> => {
      const cached = wsTokenCache.get(panelId);
      if (!forceFresh && cached && cached.exp > Date.now()) {
        return { success: true, token: cached.token, socket: cached.socket };
      }
      const cd = wsCooldown.get(panelId) || 0;
      if (cd > Date.now()) {
        return { success: false, status: 429, retryAfterMs: cd - Date.now(), error: 'cooldown rate limit' };
      }
      const inflight = wsInflight.get(panelId);
      if (inflight) return inflight;

      const req = (async () => {
        const { data: sd } = await supabase.auth.getSession();
        const at = sd.session?.access_token;
        if (!at) return { success: false, error: 'no session' } as WsTokenResp;
        const resp = await fetch(
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/ptero-ws-token`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${at}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ panelId }),
          },
        );
        const data = (await resp.json().catch(() => ({ success: false, error: 'parse error' }))) as WsTokenResp;
        if (data.success && data.token && data.socket) {
          wsTokenCache.set(panelId, { token: data.token, socket: data.socket, exp: Date.now() + WS_TOKEN_TTL_MS });
        }
        if (data.status === 429 || resp.status === 429) {
          wsCooldown.set(panelId, Date.now() + Math.max(data.retryAfterMs || 120_000, 120_000));
        }
        return data;
      })().finally(() => wsInflight.delete(panelId));
      wsInflight.set(panelId, req);
      return req;
    };

    const connectWs = async () => {
      if (cancelled) return;
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
      setConnecting(true);
      const t = await fetchToken();
      if (cancelled) { setConnecting(false); return; }
      if (!t.success || !t.token || !t.socket) {
        setConnecting(false);
        const delay = t.status === 429
          ? Math.max(t.retryAfterMs || 120_000, 120_000)
          : Math.min(60_000, 10_000 * 2 ** retryRef.current++);
        writeLine(`\x1b[33m[live console offline — retry ${Math.round(delay / 1000)}s] ${t.error || ''}\x1b[0m`);
        reconnectTimer = setTimeout(connectWs, delay);
        return;
      }
      ws = new WebSocket(t.socket);
      wsRef.current = ws;
      ws.onopen = () => {
        if (cancelled) { try { ws?.close(); } catch {} return; }
        setConnecting(false);
        setConnected(true);
        ws?.send(JSON.stringify({ event: 'auth', args: [t.token] }));
      };
      ws.onmessage = (ev) => {
        let msg: any;
        try { msg = JSON.parse(ev.data); } catch { return; }
        const e = msg?.event;
        const args = msg?.args || [];
        switch (e) {
          case 'auth success':
            retryRef.current = 0;
            ws?.send(JSON.stringify({ event: 'send logs', args: [] }));
            ws?.send(JSON.stringify({ event: 'send stats', args: [] }));
            wsStatsTimer = setInterval(() => {
              try { ws?.send(JSON.stringify({ event: 'send stats', args: [] })); } catch {}
            }, 2000);
            writeLine('\x1b[32m[live console connected]\x1b[0m');
            break;
          case 'console output':
            if (args[0]) termRef.current?.writeln(args[0]);
            break;
          case 'status':
            if (args[0]) onStateRef.current?.(args[0]);
            break;
          case 'stats':
            try {
              const s = JSON.parse(args[0]);
              onStatsRef.current?.(s);
              if (s?.state) onStateRef.current?.(s.state);
            } catch {}
            break;
          case 'token expiring':
          case 'token expired':
            wsTokenCache.delete(panelId);
            fetchToken(true).then((tk) => {
              if (tk?.token) ws?.send(JSON.stringify({ event: 'auth', args: [tk.token] }));
            });
            break;
          case 'jwt error':
            wsTokenCache.delete(panelId);
            if (args[0]) writeLine(`\x1b[33m${args[0]}\x1b[0m`);
            break;
          case 'daemon error':
          case 'daemon message':
            if (args[0]) writeLine(`\x1b[33m${args[0]}\x1b[0m`);
            break;
        }
      };
      ws.onclose = () => {
        wsRef.current = null;
        setConnecting(false);
        setConnected(false);
        if (wsStatsTimer) { clearInterval(wsStatsTimer); wsStatsTimer = null; }
        if (cancelled) return;
        const delay = Math.min(60_000, 10_000 * 2 ** retryRef.current++);
        writeLine(`\x1b[31m[disconnected — reconnect ${Math.round(delay / 1000)}s]\x1b[0m`);
        reconnectTimer = setTimeout(connectWs, delay);
      };
      ws.onerror = () => { writeLine('\x1b[31m[ws error]\x1b[0m'); };
    };

    writeLine('\x1b[36m[mode: hybrid — WS live console + REST tombol/command]\x1b[0m');
    connectWs();
    pollStatsRest();
    statsRestTimer = setInterval(pollStatsRest, STATS_REST_MS);

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (statsRestTimer) clearInterval(statsRestTimer);
      if (wsStatsTimer) clearInterval(wsStatsTimer);
      try { ws?.close(); } catch {}
      wsRef.current = null;
    };
  }, [panelId, call]);

  // Commands & power buttons SELALU via REST (PLTC) — independen dari status WS
  const send = async (raw: string) => {
    const c = (raw || cmd).trim();
    if (!c) return;
    if (!raw) setCmd('');
    const r = await call('command', { method: 'POST', body: { command: c } });
    if (!r.success) {
      termRef.current?.writeln(`\x1b[31m[command error] ${r.error || r.status}\x1b[0m`);
    }
  };

  const power = async (signal: 'start' | 'stop' | 'restart' | 'kill') => {
    const r = await call('power', { method: 'POST', body: { signal } });
    if (!r.success) {
      termRef.current?.writeln(`\x1b[31m[power error] ${r.error || r.status}\x1b[0m`);
    } else {
      termRef.current?.writeln(`\x1b[36m[power ${signal} dikirim]\x1b[0m`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => power('start')} className="bg-emerald/20 hover:bg-emerald/30 text-emerald border border-emerald/30">
          <Play className="w-3.5 h-3.5 mr-1" /> Start
        </Button>
        <Button size="sm" onClick={() => power('restart')} className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30">
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restart
        </Button>
        <Button size="sm" onClick={() => power('stop')} variant="outline">
          <Square className="w-3.5 h-3.5 mr-1" /> Stop
        </Button>
        <Button size="sm" onClick={() => power('kill')} variant="destructive">
          <Zap className="w-3.5 h-3.5 mr-1" /> Kill
        </Button>
        <div className="ml-auto text-xs flex items-center gap-2 text-muted-foreground">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald animate-pulse-slow' : 'bg-rose-400'}`} />
          {connected ? 'Live (WS)' : connecting ? 'Menghubungkan…' : 'REST mode'}
        </div>
      </div>
      <div
        ref={containerRef}
        className="rounded-xl border border-border/40 bg-black p-2"
        style={{ height: '420px' }}
      />
      <form
        onSubmit={(e) => { e.preventDefault(); send(''); }}
        className="flex gap-2"
      >
        <Input
          placeholder="Ketik perintah… (mis. say hello)"
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          className="font-mono"
        />
        <Button type="submit">
          <Send className="w-4 h-4 mr-1" /> Kirim
        </Button>
      </form>
    </div>
  );
}