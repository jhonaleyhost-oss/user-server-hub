import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  TerminalSquare, FolderTree, Settings2, CalendarClock, Database, ArrowLeft, Loader2, ServerCog,
} from 'lucide-react';
import ServerConsole from '@/components/server/Console';
import Files from '@/components/server/Files';
import Startup from '@/components/server/Startup';
import Schedules from '@/components/server/Schedules';
import Backups from '@/components/server/Backups';
import StatsCards, { ServerStats } from '@/components/server/StatsCards';
import { Button } from '@/components/ui/button';

type TabKey = 'console' | 'files' | 'startup' | 'schedules' | 'backups';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'console', label: 'Console', icon: TerminalSquare },
  { key: 'files', label: 'Files', icon: FolderTree },
  { key: 'startup', label: 'Startup', icon: Settings2 },
  { key: 'schedules', label: 'Schedules', icon: CalendarClock },
  { key: 'backups', label: 'Backups', icon: Database },
];

export default function ServerPanel() {
  const { identifier } = useParams<{ identifier: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [resolving, setResolving] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelMeta, setPanelMeta] = useState<{ username: string; ram: number; cpu: number; disk: number } | null>(null);
  const [tab, setTab] = useState<TabKey>('console');
  const [stats, setStats] = useState<ServerStats>({ state: 'offline' });

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/auth'); return; }
    if (!identifier) { navigate('/panels'); return; }

    let cancelled = false;
    (async () => {
      setResolving(true); setError(null);
      try {
        // Find panel by identifier OR by ?p=panelId
        const qPanelId = params.get('p');
        let pid = qPanelId;
        if (!pid) {
          const { data } = await supabase
            .from('user_panels').select('id, user_id')
            .eq('ptero_identifier', identifier).maybeSingle();
          if (!data) throw new Error('Server tidak ditemukan');
          pid = data.id;
        }
        // Resolve & verify via panel-session (also fills identifier if missing)
        const { data: ses, error: sesErr } = await supabase.functions.invoke('panel-session', { body: { panelId: pid } });
        if (sesErr) throw sesErr;
        if (!ses?.success) throw new Error(ses?.error || 'Gagal verifikasi akses');
        if (ses.identifier !== identifier) {
          // identifier mismatch → redirect to correct one
          navigate(`/server/${ses.identifier}?p=${pid}`, { replace: true });
          return;
        }
        const { data: meta } = await supabase
          .from('user_panels').select('username, ram, cpu, disk').eq('id', pid).single();
        if (cancelled) return;
        setPanelId(pid);
        setPanelMeta(meta as any);
      } catch (e: any) {
        setError(e?.message || String(e));
      } finally {
        if (!cancelled) setResolving(false);
      }
    })();
    return () => { cancelled = true; };
  }, [identifier, params, user, authLoading, navigate]);

  const handleStats = useCallback((s: ServerStats) => setStats((cur) => ({ ...cur, ...s })), []);
  const handleState = useCallback((st: string) => setStats((cur) => ({ ...cur, state: st })), []);

  if (resolving) {
    return (
      <PageTransition><AppShell>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="glass-card rounded-2xl p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Membuka panel server…</p>
          </div>
        </div>
      </AppShell></PageTransition>
    );
  }

  if (error || !panelId) {
    return (
      <PageTransition><AppShell>
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="glass-card rounded-2xl p-8 text-center max-w-md">
            <ServerCog className="w-12 h-12 text-rose-400 mx-auto mb-3" />
            <h2 className="font-bold text-lg mb-1">Tidak bisa membuka server</h2>
            <p className="text-sm text-muted-foreground mb-4">{error || 'Akses ditolak'}</p>
            <Link to="/panels"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-1" /> Kembali</Button></Link>
          </div>
        </div>
      </AppShell></PageTransition>
    );
  }

  return (
    <PageTransition>
      <AppShell>
        <div className="min-h-screen py-4 sm:py-6 px-3 sm:px-4 bg-background">
          <div className="max-w-6xl mx-auto space-y-4">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
              <Link to="/panels"><Button size="sm" variant="outline"><ArrowLeft className="w-4 h-4" /></Button></Link>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold truncate">{panelMeta?.username || 'Server'}</h1>
                <p className="text-xs text-muted-foreground">Panel kontrol penuh</p>
              </div>
            </motion.div>

            {/* Stats */}
            <StatsCards stats={stats} limits={panelMeta ? { memory: panelMeta.ram, disk: panelMeta.disk, cpu: panelMeta.cpu } : undefined} />

            {/* Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 sticky top-0 z-10">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all border ${
                    tab === t.key
                      ? 'bg-primary text-primary-foreground border-primary shadow-glow'
                      : 'glass-card border-border/40 hover:border-primary/40 text-foreground'
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content (mount all for console keep-alive when switching) */}
            <div className="glass-card rounded-2xl p-3 sm:p-4 border border-border/40">
              <div style={{ display: tab === 'console' ? 'block' : 'none' }}>
                <ServerConsole panelId={panelId} onStats={handleStats} onState={handleState} />
              </div>
              {tab === 'files' && <Files panelId={panelId} />}
              {tab === 'startup' && <Startup panelId={panelId} />}
              {tab === 'schedules' && <Schedules panelId={panelId} />}
              {tab === 'backups' && <Backups panelId={panelId} />}
            </div>
          </div>
        </div>
      </AppShell>
    </PageTransition>
  );
}