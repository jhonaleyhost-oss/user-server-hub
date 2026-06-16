import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ExternalLink,
  Copy,
  RefreshCw,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Terminal,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface PanelInfo {
  id: string;
  username: string;
  password: string;
  login_url: string;
  pterodactyl_servers: { name: string; domain: string } | null;
}

const Server = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [panel, setPanel] = useState<PanelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [showCreds, setShowCreds] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!id) {
      navigate('/panels');
      return;
    }
    fetchPanel();
  }, [user, authLoading, id]);

  const fetchPanel = async () => {
    try {
      const { data, error } = await supabase
        .from('user_panels')
        .select('id, username, password, login_url, pterodactyl_servers(name, domain)')
        .eq('id', id!)
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast({ variant: 'destructive', title: 'Panel tidak ditemukan' });
        navigate('/panels');
        return;
      }
      setPanel(data as unknown as PanelInfo);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Gagal memuat server' });
      navigate('/panels');
    } finally {
      setLoading(false);
    }
  };

  // Detect X-Frame-Options block: if iframe never fires 'load' within 6s, assume blocked
  useEffect(() => {
    if (!panel) return;
    setIframeLoaded(false);
    setIframeBlocked(false);
    const t = setTimeout(() => {
      if (!iframeLoaded) setIframeBlocked(true);
    }, 6000);
    return () => clearTimeout(t);
  }, [panel, iframeKey]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Tersalin', description: `${label} disalin ke clipboard.` });
  };

  const reload = () => {
    setIframeKey((k) => k + 1);
  };

  if (loading || !panel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Memuat server...
        </div>
      </div>
    );
  }

  const serverName = panel.pterodactyl_servers?.name || 'Server';

  return (
    <PageTransition>
      <div className={`min-h-screen bg-background flex flex-col ${fullscreen ? 'fixed inset-0 z-50' : ''}`}>
        {/* Top Bar — jhonaleystore themed */}
        <header className="h-14 shrink-0 border-b border-sidebar-border bg-background/80 backdrop-blur-xl flex items-center px-3 gap-2 sticky top-0 z-30">
          <Link
            to="/panels"
            className="h-10 w-10 rounded-full bg-secondary/50 hover:bg-secondary border border-sidebar-border flex items-center justify-center transition-colors"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Terminal className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground truncate leading-tight">
                {panel.username}
              </h1>
              <p className="text-[10px] text-muted-foreground truncate leading-tight">
                {serverName} · Jhonaley Server
              </p>
            </div>
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={reload}
            className="h-10 w-10 rounded-full"
            aria-label="Reload"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setFullscreen((v) => !v)}
            className="h-10 w-10 rounded-full hidden sm:inline-flex"
            aria-label="Fullscreen"
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => window.open(panel.login_url, '_blank', 'noopener,noreferrer')}
            className="h-10 w-10 rounded-full"
            aria-label="Buka di tab baru"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </header>

        {/* Credential helper banner (collapsible) */}
        {showCreds && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="border-b border-sidebar-border bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5"
          >
            <div className="px-3 py-2.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground shrink-0 font-medium">Login:</span>
              <button
                onClick={() => copy(panel.username, 'Username')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/60 hover:bg-background border border-border/50 font-mono"
              >
                <span className="text-muted-foreground">user</span>
                <span className="text-foreground">{panel.username}</span>
                <Copy className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                onClick={() => copy(panel.password, 'Password')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-background/60 hover:bg-background border border-border/50 font-mono"
              >
                <span className="text-muted-foreground">pass</span>
                <span className="text-foreground">{showPwd ? panel.password : '••••••••'}</span>
                <Copy className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                onClick={() => setShowPwd((v) => !v)}
                className="p-1.5 rounded-md hover:bg-background/60 text-muted-foreground"
                aria-label="Toggle password"
              >
                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setShowCreds(false)}
                className="ml-auto text-muted-foreground hover:text-foreground px-2 py-1 text-[11px]"
              >
                Tutup
              </button>
            </div>
          </motion.div>
        )}

        {/* Iframe / fallback */}
        <div className="flex-1 relative bg-black">
          {!iframeBlocked ? (
            <>
              {!iframeLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm">Menghubungkan ke server...</p>
                  </div>
                </div>
              )}
              <iframe
                key={iframeKey}
                ref={iframeRef}
                src={panel.login_url}
                title={`Server ${panel.username}`}
                className="w-full h-full border-0"
                style={{ minHeight: 'calc(100vh - 56px)' }}
                onLoad={() => setIframeLoaded(true)}
                allow="clipboard-read; clipboard-write; fullscreen"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox"
              />
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-6 bg-background">
              <div className="max-w-md w-full text-center space-y-5">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground mb-2">
                    Server tidak dapat ditampilkan di sini
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Server memblokir tampilan via embed (X-Frame-Options).
                    Silakan buka langsung di tab baru untuk mengakses panel sepenuhnya.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => window.open(panel.login_url, '_blank', 'noopener,noreferrer')}
                    className="w-full"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Buka Panel di Tab Baru
                  </Button>
                  <Button variant="outline" onClick={reload} className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Coba Lagi
                  </Button>
                  <Link
                    to="/panels"
                    className="text-xs text-muted-foreground hover:text-foreground pt-2"
                  >
                    ← Kembali ke daftar panel
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default Server;