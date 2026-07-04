import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Calendar,
  Copy,
  Trash2,
  Send,
  ChevronDown,
  Plus,
  Ghost,
  ExternalLink,
  User as UserIcon,
  Server as ServerIcon,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { PageTransition } from '@/components/PageTransition';
import AppShell from '@/components/AppShell';

import GlassCard from '@/components/GlassCard';
import ProcessLogDialog from '@/components/ProcessLogDialog';
import ThemeToggle from '@/components/ThemeToggle';
import AccentColorPicker from '@/components/AccentColorPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserPanel {
  id: string;
  username: string;
  email: string;
  password: string;
  login_url: string;
  ram: number;
  cpu: number;
  is_active: boolean;
  created_at: string;
  ptero_server_id: number | null;
  ptero_user_id: number | null;
  pterodactyl_servers: {
    name: string;
  };
}

interface PanelGroup {
  key: string;
  username: string;
  email: string;
  password: string;
  login_url: string;
  ptero_user_id: number | null;
  panels: UserPanel[];
}

const Panels = () => {
  const { user, loading: authLoading } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [panels, setPanels] = useState<UserPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [waNumbers, setWaNumbers] = useState<Record<string, string>>({});
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logDialogSuccess, setLogDialogSuccess] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchPanels();
  }, [user, authLoading]);

  const fetchPanels = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_panels')
        .select(`
          *,
          pterodactyl_servers (name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPanels(data || []);
    } catch (err) {
      console.error('Error fetching panels:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Tersalin!',
      description: `${label} berhasil disalin ke clipboard.`,
    });
  };

  const handleSendWA = (group: PanelGroup) => {
    const waNumber = waNumbers[group.key];
    if (!waNumber) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Isi nomor WhatsApp terlebih dahulu.',
      });
      return;
    }

    const serverList = group.panels.map((p, i) => `${i + 1}. ${p.username}`).join('\n');
    const message = `*ACCESS DETAILS*
━━━━━━━━━━━━━━━━
Username: ${group.username}
Password: ${group.password}
Login URL: ${group.login_url}

Server (${group.panels.length}):
${serverList}
━━━━━━━━━━━━━━━━
*DILARANG PERJUALBELIKAN!*`;

    window.open(
      `https://api.whatsapp.com/send?phone=${waNumber}&text=${encodeURIComponent(message)}`,
      '_blank'
    );
  };

  const handleDelete = async (panelId: string) => {
    setDeleting(panelId);
    try {
      // Call edge function to delete from Pterodactyl and database
      const { data, error } = await supabase.functions.invoke('delete-panel', {
        body: { panelId },
      });

      if (error) throw error;
      
      if (!data.success) {
        setProcessLogs(Array.isArray(data?.logs) ? data.logs : []);
        setLogDialogSuccess(false);
        setLogDialogOpen(true);
        throw new Error(data.error || 'Gagal menghapus panel');
      }

      setProcessLogs(Array.isArray(data?.logs) ? data.logs : []);
      setLogDialogSuccess(true);
      setLogDialogOpen(true);

      toast({
        title: 'Berhasil',
        description: data?.message || 'Panel berhasil dihapus.',
      });

      fetchPanels();
    } catch (err: any) {
      console.error('Delete panel error:', err);
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: err.message || 'Gagal menghapus panel.',
      });
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card rounded-2xl p-8">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground mt-4">Memuat panel...</p>
        </div>
      </div>
    );
  }

  // Group panels by Pterodactyl user (login_url + ptero_user_id)
  const groups: PanelGroup[] = [];
  const groupMap = new Map<string, PanelGroup>();
  // Iterate oldest→newest so the FIRST panel (which created the Ptero user)
  // becomes the group's login username. Reused panels only add servers.
  const panelsChrono = [...panels].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  panelsChrono.forEach((p) => {
    const key = `${p.login_url}|${p.ptero_user_id ?? p.id}`;
    let g = groupMap.get(key);
    if (!g) {
      g = {
        key,
        username: p.username,
        email: p.email,
        password: p.password,
        login_url: p.login_url,
        ptero_user_id: p.ptero_user_id,
        panels: [],
      };
      groupMap.set(key, g);
      groups.push(g);
    }
    g.panels.push(p);
  });

  return (
    <PageTransition>
    <AppShell>
    <div className="min-h-screen py-8 px-4 bg-background">


      <div className="w-full max-w-3xl mx-auto relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">Akun & Panel Anda</h1>
            <p className="text-sm text-muted-foreground">
              {groups.length} akun Pterodactyl · {panels.length} server aktif
            </p>
          </div>
        </motion.div>

        {/* Panels List */}
        <div className="space-y-4">
          {groups.length === 0 ? (
            <GlassCard className="text-center py-12 border-dashed border-2 border-border">
              <Ghost className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-bold text-foreground">Belum ada panel</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Anda belum membuat server apapun.
              </p>
              <Link
                to="/"
                className="inline-flex items-center gap-2 btn-primary"
              >
                Buat Panel Sekarang
              </Link>
            </GlassCard>
          ) : (
            groups.map((group) => {
              const isOpen = expandedGroup === group.key;
              const isPwVisible = !!showPassword[group.key];
              return (
                <GlassCard key={group.key} className="overflow-hidden" animate={false}>
                  {/* User Header */}
                  <div
                    className="panel-card-header p-4 cursor-pointer flex items-center justify-between group"
                    onClick={() => setExpandedGroup(isOpen ? null : group.key)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground shrink-0 shadow-md">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-foreground text-sm sm:text-base truncate">
                            {group.username}
                          </h3>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                            {group.panels.length} SERVER
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {group.login_url.replace(/^https?:\/\//, '')}
                        </p>
                      </div>
                    </div>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </motion.div>
                  </div>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-border/30"
                      >
                        <div className="p-4 space-y-4">
                          {/* Credentials */}
                          <div className="rounded-xl border border-border/50 bg-background/50 divide-y divide-border/50">
                            <div className="p-3 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Login URL</p>
                                <a
                                  href={group.login_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline truncate block max-w-full"
                                >
                                  {group.login_url}
                                </a>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <a
                                  href={group.login_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                                <button
                                  onClick={() => copyToClipboard(group.login_url, 'URL')}
                                  className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <div className="p-3 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] uppercase tracking-wider text-primary font-bold flex items-center gap-1">
                                  Username Login
                                  <span className="text-[9px] font-black px-1 py-0.5 rounded bg-primary/15 text-primary normal-case tracking-normal">PAKAI INI UNTUK LOGIN</span>
                                </p>
                                <p className="text-sm font-mono text-foreground truncate">{group.username}</p>
                              </div>
                              <button
                                onClick={() => copyToClipboard(group.username, 'Username')}
                                className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground shrink-0"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="p-3 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Password</p>
                                <p className={`text-sm font-mono text-foreground truncate ${isPwVisible ? '' : 'blur-sm select-none'}`}>
                                  {group.password}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() =>
                                    setShowPassword((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                                  }
                                  className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
                                >
                                  {isPwVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={() => copyToClipboard(group.password, 'Password')}
                                  className="p-1.5 hover:bg-secondary rounded text-muted-foreground hover:text-foreground"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Server list */}
                          <div>
                            <div className="flex items-center justify-between mb-2 px-1">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                                Nama Server ({group.panels.length})
                              </p>
                              <p className="text-[10px] text-muted-foreground italic">
                                bukan buat login
                              </p>
                            </div>
                            <div className="space-y-2">
                              {group.panels.map((panel) => (
                                <div
                                  key={panel.id}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50"
                                >
                                  <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                                    <ServerIcon className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-foreground truncate">{panel.username}</p>
                                    <p className="text-[10px] text-muted-foreground">Nama server</p>
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(panel.created_at)}
                                      </span>
                                      <span className="w-1 h-1 bg-muted-foreground rounded-full" />
                                      <span className="text-emerald flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-emerald rounded-full animate-pulse-slow" />
                                        Active
                                      </span>
                                    </div>
                                  </div>
                                  {role !== 'free' && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <button className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 shrink-0">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="glass-card">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Hapus Server?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Yakin ingin menghapus server "{panel.username}" secara permanen?
                                            User Pterodactyl <b>{group.username}</b> tetap ada selama masih punya server lain.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Batal</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDelete(panel.id)}
                                            className="bg-destructive hover:bg-destructive/90"
                                          >
                                            {deleting === panel.id ? 'Menghapus...' : 'Hapus'}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Send via WA */}
                          <div className="pt-3 border-t border-border/50 flex flex-col sm:flex-row gap-2">
                            <Input
                              type="tel"
                              placeholder="No. WhatsApp (628xx)"
                              value={waNumbers[group.key] || ''}
                              onChange={(e) =>
                                setWaNumbers((prev) => ({ ...prev, [group.key]: e.target.value }))
                              }
                              className="input-glass flex-1"
                            />
                            <Button
                              variant="outline"
                              onClick={() => handleSendWA(group)}
                              className="bg-emerald/10 hover:bg-emerald/20 text-emerald border-emerald/30 sm:w-auto"
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Kirim Akses
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              );
            })
          )}
        </div>

        {/* Back to Dashboard */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center"
        >
          <Link to="/" className="text-primary hover:text-primary/80 text-sm font-medium">
            ← Kembali ke Dashboard
          </Link>
        </motion.div>
      </div>
    </div>
    <ProcessLogDialog
      open={logDialogOpen}
      onOpenChange={setLogDialogOpen}
      title="Log Hapus Panel"
      description="Proses langkah demi langkah saat menghapus panel."
      logs={processLogs}
      success={logDialogSuccess}
    />
    </AppShell>
    </PageTransition>
  );
};

export default Panels;
