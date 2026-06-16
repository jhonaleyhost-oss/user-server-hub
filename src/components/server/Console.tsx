import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Square, RotateCcw, Zap, Send } from 'lucide-react';
import type { ServerStats } from './StatsCards';
import { usePteroProxy } from '@/hooks/usePteroProxy';

interface Props {
  panelId: string;
  onStats?: (s: ServerStats) => void;
  onState?: (s: string) => void;
}

const STATS_INTERVAL_MS = 3000;
const LOGS_INTERVAL_MS = 3000;
const LOG_FILE = '/logs/latest.log';

export default function ServerConsole({ panelId, onStats, onState }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [logsAvailable, setLogsAvailable] = useState<boolean | null>(null);
  const [cmd, setCmd] = useState('');
  const { call } = usePteroProxy(panelId);

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

  // Polling stats + logs via REST (PLTC API key)
  useEffect(() => {
    let cancelled = false;
    let statsTimer: any = null;
    let logsTimer: any = null;
    let lastLogLen = 0;
    let logsOk = true;
    let firstLog = true;

    const writeLine = (txt: string) => termRef.current?.writeln(txt);

    const pollStats = async () => {
      if (cancelled) return;
      const r = await call<any>('resources');
      if (cancelled) return;
      if (r.success) {
        setConnected(true);
        const a = r.data?.attributes;
        const res = a?.resources || {};
        const stats: ServerStats = {
          state: a?.current_state,
          cpu_absolute: res.cpu_absolute,
          memory_bytes: res.memory_bytes,
          disk_bytes: res.disk_bytes,
          network: { rx_bytes: res.network_rx_bytes, tx_bytes: res.network_tx_bytes },
          uptime: res.uptime,
        };
        onStatsRef.current?.(stats);
        if (a?.current_state) onStateRef.current?.(a.current_state);
      } else {
        setConnected(false);
      }
    };

    const pollLogs = async () => {
      if (cancelled || !logsOk) return;
      const r = await call<any>('files/contents', { query: { file: LOG_FILE } });
      if (cancelled) return;
      if (!r.success) {
        if (r.status === 404 || r.status === 500) {
          logsOk = false;
          setLogsAvailable(false);
          writeLine('\x1b[33m[info] File log realtime tidak tersedia di panel ini. Stats & tombol tetap berjalan.\x1b[0m');
        }
        return;
      }
      setLogsAvailable(true);
      const content = typeof r.data === 'string' ? r.data : (r.data?.toString?.() || '');
      if (firstLog) {
        // Print last ~100 lines on first load
        const lines = content.split('\n');
        const tail = lines.slice(-100).join('\n');
        tail.split('\n').forEach((l) => l && writeLine(l));
        lastLogLen = content.length;
        firstLog = false;
      } else if (content.length > lastLogLen) {
        const fresh = content.slice(lastLogLen);
        fresh.split('\n').forEach((l) => l && writeLine(l));
        lastLogLen = content.length;
      } else if (content.length < lastLogLen) {
        // log rotated
        lastLogLen = 0;
      }
    };

    writeLine('\x1b[32m[mode: REST polling tiap 3 detik]\x1b[0m');
    pollStats();
    pollLogs();
    statsTimer = setInterval(pollStats, STATS_INTERVAL_MS);
    logsTimer = setInterval(pollLogs, LOGS_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (statsTimer) clearInterval(statsTimer);
      if (logsTimer) clearInterval(logsTimer);
    };
  }, [panelId, call]);

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
          {connected ? `REST · ${logsAvailable === false ? 'logs N/A' : 'polling 3s'}` : 'Tidak terhubung'}
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