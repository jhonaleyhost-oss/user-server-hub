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

export default function ServerConsole({ panelId, onStats, onState }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
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

    const fetchToken = async () => {
      const { data } = await supabase.functions.invoke('ptero-ws-token', { body: { panelId } });
      return data as { success: boolean; token?: string; socket?: string; error?: string };
    };

    const writeLine = (txt: string) => termRef.current?.writeln(txt);

    const connect = async () => {
      if (cancelled) return;
      try {
        const t = await fetchToken();
        if (!t?.success || !t.token || !t.socket) {
          writeLine(`\x1b[31m[error] ${t?.error || 'gagal ambil token WS'}\x1b[0m`);
          return;
        }
        ws = new WebSocket(t.socket);
        wsRef.current = ws;
        ws.onopen = () => {
          setConnected(true);
          ws?.send(JSON.stringify({ event: 'auth', args: [t.token] }));
        };
        ws.onmessage = (ev) => {
          let msg: any; try { msg = JSON.parse(ev.data); } catch { return; }
          const e = msg?.event; const args = msg?.args || [];
          switch (e) {
            case 'auth success':
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
              fetchToken().then((tk) => {
                if (tk?.token) ws?.send(JSON.stringify({ event: 'auth', args: [tk.token] }));
              });
              break;
            }
            case 'jwt error':
            case 'daemon error':
            case 'daemon message':
              if (args[0]) writeLine(`\x1b[33m${args[0]}\x1b[0m`);
              break;
          }
        };
        ws.onclose = () => {
          setConnected(false);
          if (statsInterval) clearInterval(statsInterval);
          writeLine('\x1b[31m[disconnected — reconnecting in 3s]\x1b[0m');
          if (!cancelled) reconnectTimer = setTimeout(connect, 3000);
        };
        ws.onerror = () => { writeLine('\x1b[31m[ws error]\x1b[0m'); };
      } catch (err: any) {
        writeLine(`\x1b[31m${err?.message || err}\x1b[0m`);
        if (!cancelled) reconnectTimer = setTimeout(connect, 3000);
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
    const c = raw || cmd;
    wsRef.current?.send(JSON.stringify({ event: 'send command', args: [c] }));
    if (!raw) setCmd('');
  };

  const power = (state: 'start' | 'stop' | 'restart' | 'kill') => {
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
          {connected ? 'Terhubung' : 'Tidak terhubung'}
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