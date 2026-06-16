import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Square, RotateCcw, Zap, Send } from 'lucide-react';
import type { ServerStats } from './StatsCards';

interface Props {
  panelId: string;
  onStats?: (s: ServerStats) => void;
  onState?: (s: string) => void;
}

type WsTokenResponse = {
  success: boolean;
  token?: string;
  socket?: string;
  error?: string;
  status?: number;
  retryAfterMs?: number;
};

const WS_TOKEN_TTL_MS = 8 * 60 * 1000;
const wsTokenCache = new Map<string, { token: string; socket: string; exp: number }>();
const wsCooldownCache = new Map<string, number>();
const wsTokenInflight = new Map<string, Promise<WsTokenResponse>>();

export default function ServerConsole({ panelId, onStats, onState }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [cmd, setCmd] = useState('');

  // Keep latest callbacks in refs so the WS effect doesn't re-run on every render
  const onStatsRef = useRef(onStats);
  const onStateRef = useRef(onState);
  useEffect(() => { onStatsRef.current = onStats; }, [onStats]);
  useEffect(() => { onStateRef.current = onState; }, [onState]);

  // init xterm once
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

  // connect WS
  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;
    let statsInterval: any = null;

    const clearTokenCache = () => wsTokenCache.delete(panelId);

    const fetchToken = async (forceFresh = false): Promise<WsTokenResponse> => {
      const cached = wsTokenCache.get(panelId);
      if (!forceFresh && cached && cached.exp > Date.now()) {
        return { success: true, token: cached.token, socket: cached.socket };
      }

      const cooldownUntil = wsCooldownCache.get(panelId) || 0;
      if (cooldownUntil > Date.now()) {
        return {
          success: false,
          status: 429,
          retryAfterMs: cooldownUntil - Date.now(),
          error: 'Console sedang cooldown karena rate limit. Tunggu sebentar.',
        };
      }

      const inflight = wsTokenInflight.get(panelId);
      if (inflight) return inflight;

      const request = (async () => {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) return { success: false, error: 'Sesi login tidak ditemukan' };

        const resp = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/ptero-ws-token`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ panelId }),
        });
        const data = await resp.json().catch(() => ({ success: false, error: 'Gagal membaca response token WS' })) as WsTokenResponse;
        if (data.success && data.token && data.socket) {
          wsTokenCache.set(panelId, { token: data.token, socket: data.socket, exp: Date.now() + WS_TOKEN_TTL_MS });
        }
        if (data.status === 429 || resp.status === 429) {
          wsCooldownCache.set(panelId, Date.now() + Math.max(data.retryAfterMs || 120_000, 120_000));
        }
        return data;
      })().finally(() => wsTokenInflight.delete(panelId));

      wsTokenInflight.set(panelId, request);
      return request;
    };

    const writeLine = (txt: string) => termRef.current?.writeln(txt);

    const connect = async () => {
      if (cancelled) return;
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;
        setConnecting(true);
        const t = await fetchToken();
        if (!t?.success || !t.token || !t.socket) {
          setConnecting(false);
          writeLine(`\x1b[31m[error] ${t?.error || 'gagal ambil token WS'}\x1b[0m`);
          const delay = t?.status === 429 ? Math.max(t.retryAfterMs || 120_000, 120_000) : Math.min(60_000, 10_000 * 2 ** retryRef.current++);
          if (!cancelled) reconnectTimer = setTimeout(connect, delay);
          return;
        }
        ws = new WebSocket(t.socket);
        wsRef.current = ws;
        ws.onopen = () => {
          setConnecting(false);
          setConnected(true);
          ws?.send(JSON.stringify({ event: 'auth', args: [t.token] }));
        };
        ws.onmessage = (ev) => {
          let msg: any; try { msg = JSON.parse(ev.data); } catch { return; }
          const e = msg?.event; const args = msg?.args || [];
          switch (e) {
            case 'auth success':
              retryRef.current = 0;
              ws?.send(JSON.stringify({ event: 'send logs', args: [] }));
              ws?.send(JSON.stringify({ event: 'send stats', args: [] }));
              statsInterval = setInterval(() => {
                try { ws?.send(JSON.stringify({ event: 'send stats', args: [] })); } catch {}
              }, 2000);
              writeLine('\x1b[32m[connected]\x1b[0m');
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
            case 'token expired': {
              clearTokenCache();
              fetchToken().then((tk) => {
                if (tk?.token) ws?.send(JSON.stringify({ event: 'auth', args: [tk.token] }));
              });
              break;
            }
            case 'jwt error':
              clearTokenCache();
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
          if (statsInterval) clearInterval(statsInterval);
          const delay = Math.min(60_000, 10_000 * 2 ** retryRef.current++);
          writeLine(`\x1b[31m[disconnected — reconnecting in ${Math.round(delay / 1000)}s]\x1b[0m`);
          if (!cancelled) reconnectTimer = setTimeout(connect, delay);
        };
        ws.onerror = () => { writeLine('\x1b[31m[ws error]\x1b[0m'); };
      } catch (err: any) {
        setConnecting(false);
        writeLine(`\x1b[31m${err?.message || err}\x1b[0m`);
        const delay = Math.min(60_000, 10_000 * 2 ** retryRef.current++);
        if (!cancelled) reconnectTimer = setTimeout(connect, delay);
      }
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (statsInterval) clearInterval(statsInterval);
      try { ws?.close(); } catch {}
      wsRef.current = null;
    };
  }, [panelId]);

  const send = (raw: string) => {
    if (!cmd.trim() && !raw) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const c = raw || cmd;
    wsRef.current?.send(JSON.stringify({ event: 'send command', args: [c] }));
    if (!raw) setCmd('');
  };

  const power = (state: 'start' | 'stop' | 'restart' | 'kill') => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current?.send(JSON.stringify({ event: 'set state', args: [state] }));
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
          {connected ? 'Terhubung' : connecting ? 'Menghubungkan…' : 'Tidak terhubung'}
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
        <Button type="submit" disabled={!connected}>
          <Send className="w-4 h-4 mr-1" /> Kirim
        </Button>
      </form>
    </div>
  );
}