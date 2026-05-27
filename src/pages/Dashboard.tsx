import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Server,
  Users,
  Cpu,
  HardDrive,
  LogOut,
  List,
  Crown,
  Star,
  Check,
  Zap,
  ShieldCheck,
  Code,
  Terminal,
  Globe,
  Send,
  AlertTriangle,
  Sparkles as SparklesIcon,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { PageTransition } from '@/components/PageTransition';
import AppShell from '@/components/AppShell';

import ServerStatusDisplay from '@/components/ServerStatusDisplay';
import GlassCard from '@/components/GlassCard';
import StatCard from '@/components/StatCard';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import AccentColorPicker from '@/components/AccentColorPicker';
import ActivityTicker from '@/components/ActivityTicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PterodactylServer {
  id: string;
  name: string;
  domain: string;
  server_type: string;
  is_active: boolean;
}

interface UserProfile {
  panel_creations_count: number;
}

interface ResellerStatus {
  is_reseller: boolean;
  permanent: boolean;
  expires_at: string | null;
  days_left: number | null;
}

const Dashboard = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { role, isAdmin, isPremium, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [servers, setServers] = useState<PterodactylServer[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [panelCount, setPanelCount] = useState(0);
  const [userServerId, setUserServerId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [resellerStatus, setResellerStatus] = useState<ResellerStatus | null>(null);

  // Form state
  const [username, setUsername] = useState('');
  const [selectedServer, setSelectedServer] = useState('');
  const [ram, setRam] = useState('1');
  const [cpu, setCpu] = useState('40');
  const [panelType, setPanelType] = useState<'nodejs' | 'python'>('nodejs');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchData();
  }, [user, authLoading]);

  const fetchData = async () => {
    if (!user) return;

    try {
      // Fetch servers via edge function (no API keys exposed)
      const { data: { session } } = await supabase.auth.getSession();
      const { data: serverResponse, error: serverFnError } = await supabase.functions.invoke('list-servers', {
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : undefined,
      });
      
      if (!serverFnError && serverResponse?.success && serverResponse.servers) {
        setServers(serverResponse.servers);
        if (serverResponse.servers.length > 0) {
          setSelectedServer(serverResponse.servers[0].id);
        }
      }

      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('panel_creations_count')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profileData) {
        setProfile(profileData);
      }

      // Fetch user's panels count and get server_id of first panel
      const { data: panelsData, count } = await supabase
        .from('user_panels')
        .select('server_id', { count: 'exact' })
        .eq('user_id', user.id);
      
      setPanelCount(count || 0);
      if (panelsData && panelsData.length > 0) {
        setUserServerId(panelsData[0].server_id);
      }

      // Fetch reseller expiry status
      const { data: statusData } = await (supabase.rpc as any)('get_my_reseller_status');
      if (statusData && statusData.length > 0) {
        setResellerStatus(statusData[0] as ResellerStatus);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !selectedServer || !username) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Lengkapi semua field yang diperlukan.',
      });
      return;
    }

    // Validate for free users
    if (role === 'free') {
      if (panelCount >= 1) {
        toast({
          variant: 'destructive',
          title: 'Batas Tercapai',
          description: 'Upgrade ke Premium untuk membuat lebih banyak panel.',
        });
        return;
      }
      if (ram !== '1' || cpu !== '40') {
        toast({
          variant: 'destructive',
          title: 'Akses Ditolak',
          description: 'User gratis hanya bisa menggunakan 1GB RAM dan 40% CPU.',
        });
        return;
      }
    }

    setSubmitting(true);

    try {
      const selectedServerData = servers.find(s => s.id === selectedServer);
      if (!selectedServerData) throw new Error('Server tidak ditemukan');

      // Check if free user trying to use private server
      if (role === 'free' && selectedServerData.server_type === 'private') {
        toast({
          variant: 'destructive',
          title: 'Akses Ditolak',
          description: 'User gratis hanya bisa menggunakan server public.',
        });
        setSubmitting(false);
        return;
      }

      const ramMB = ram === 'unli' ? 0 : parseInt(ram) * 1024;
      const cpuPercent = cpu === 'unli' ? 0 : parseInt(cpu);
      const diskMB = ram === 'unli' ? 0 : parseInt(ram) * 1024;

      // Call edge function to create panel in Pterodactyl
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-panel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData?.session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            username: username,
            serverId: selectedServer,
            ram: ramMB,
            cpu: cpuPercent,
            disk: diskMB,
            panelType: panelType,
          }),
        }
      );

      const data = await response.json();
      
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Gagal membuat panel');
      }

      toast({
        title: 'Berhasil!',
        description: 'Panel berhasil dibuat di Pterodactyl. Cek di List Panel.',
      });

      setUsername('');
      fetchData();
    } catch (err: any) {
      console.error('Create panel error:', err);
      
      // Extract error message from various error formats
      let errorMessage = 'Terjadi kesalahan.';
      
      if (typeof err === 'string') {
        errorMessage = err;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (err?.error) {
        errorMessage = err.error;
      }
      
      toast({
        variant: 'destructive',
        title: 'Gagal Membuat Panel',
        description: errorMessage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleLabel = () => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'reseller': return 'Reseller';
      case 'premium': return 'Premium';
      default: return 'Free';
    }
  };

  const getMaxPanels = () => {
    switch (role) {
      case 'admin': return '∞';
      case 'reseller': return '∞';
      case 'premium': return '10';
      default: return '1';
    }
  };

  // Show loading only while auth is loading, not during data fetch
  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card rounded-2xl p-8">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground mt-4">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
    <AppShell>
    <div className="min-h-screen py-6 px-4 bg-background">


      <div className="w-full max-w-2xl mx-auto relative z-10">
        <ActivityTicker />

        {/* Reseller expiry warning (<=2 days, not permanent) */}
        {resellerStatus &&
          resellerStatus.is_reseller &&
          !resellerStatus.permanent &&
          resellerStatus.days_left !== null &&
          resellerStatus.days_left <= 2 && (
            <Link to="/upgrade" className="block mb-4">
              <div className="rounded-2xl p-4 bg-gradient-to-r from-destructive/20 via-amber/20 to-destructive/20 border border-destructive/40 flex items-center gap-3 hover:scale-[1.01] transition-transform">
                <div className="w-10 h-10 rounded-full bg-destructive/30 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">
                    Reseller akan expired {resellerStatus.days_left <= 0 ? 'hari ini' : `dalam ${resellerStatus.days_left} hari`}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {resellerStatus.expires_at
                      ? `Berakhir ${new Date(resellerStatus.expires_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                      : ''}{' '}
                    • Perpanjang sekarang →
                  </p>
                </div>
              </div>
            </Link>
          )}

        {/* Free user limit notice — hidden once upgraded */}
        {role === 'free' && (
          <Link to="/upgrade" className="block mb-4">
            <div className="rounded-2xl p-4 bg-gradient-to-br from-primary/15 via-accent/10 to-amber/15 border border-primary/30 flex items-center gap-3 hover:scale-[1.01] transition-transform">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  Akun Free <SparklesIcon className="w-3.5 h-3.5 text-amber" />
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Maks <b className="text-foreground">1 panel</b> • <b className="text-foreground">1GB RAM</b> • <b className="text-foreground">40% CPU</b>. Upgrade Reseller untuk akses penuh →
                </p>
              </div>
              <Button size="sm" className="bg-gradient-to-r from-amber to-primary text-background font-bold shrink-0">
                Upgrade
              </Button>
            </div>
          </Link>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon={Server}
            label="Server Tersedia"
            value={servers.length}
            status="online"
            delay={0.1}
          />
          <StatCard
            icon={HardDrive}
            label="Panel Anda"
            value={panelCount}
            delay={0.15}
          />
          <StatCard
            icon={Users}
            label="Role"
            value={getRoleLabel()}
            delay={0.2}
          />
          <StatCard
            icon={Cpu}
            label="Kuota"
            value={`${panelCount}/${getMaxPanels()}`}
            delay={0.25}
          />
        </div>

        {/* Server Status */}
        <div className="mb-6">
          <ServerStatusDisplay selectedServerId={userServerId} />
        </div>

        {/* Create Panel Form */}
        <GlassCard className="p-6 sm:p-8" delay={0.4}>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-2">Buat Server Baru</h2>
            <p className="text-muted-foreground text-sm">
              Konfigurasikan spesifikasi server bot Anda di bawah ini.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-muted-foreground">
                Nama Server / User
              </Label>
              <div className="relative">
                <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Contoh: Jhonaley"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="input-glass pl-10"
                />
              </div>
            </div>

            {/* Server Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-muted-foreground">
                Lokasi Server
              </Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                <Select value={selectedServer} onValueChange={setSelectedServer}>
                  <SelectTrigger className="input-glass pl-10">
                    <SelectValue placeholder="Pilih server" />
                  </SelectTrigger>
                  <SelectContent>
                    {servers.map((server) => (
                      <SelectItem
                        key={server.id}
                        value={server.id}
                        disabled={role === 'free' && server.server_type === 'private'}
                      >
                        {server.name}
                        {server.server_type === 'private' && role === 'free' && ' (VIP Only)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Resources */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-muted-foreground">RAM (GB)</Label>
                <Select
                  value={ram}
                  onValueChange={setRam}
                  disabled={role === 'free'}
                >
                  <SelectTrigger className="input-glass">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 GB</SelectItem>
                    <SelectItem value="2" disabled={role === 'free'}>2 GB</SelectItem>
                    <SelectItem value="3" disabled={role === 'free'}>3 GB</SelectItem>
                    <SelectItem value="4" disabled={role === 'free'}>4 GB</SelectItem>
                    <SelectItem value="6" disabled={role === 'free'}>6 GB</SelectItem>
                    <SelectItem value="8" disabled={role === 'free'}>8 GB</SelectItem>
                    <SelectItem value="10" disabled={role === 'free'}>10 GB</SelectItem>
                    <SelectItem value="12" disabled={role === 'free'}>12 GB</SelectItem>
                    <SelectItem value="16" disabled={role === 'free'}>16 GB</SelectItem>
                    <SelectItem value="20" disabled={role === 'free'}>20 GB</SelectItem>
                    {isPremium && <SelectItem value="unli">Unlimited</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-muted-foreground">CPU (%)</Label>
                <Select
                  value={cpu}
                  onValueChange={setCpu}
                  disabled={role === 'free'}
                >
                  <SelectTrigger className="input-glass">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="40">40%</SelectItem>
                    <SelectItem value="100" disabled={role === 'free'}>100%</SelectItem>
                    <SelectItem value="200" disabled={role === 'free'}>200%</SelectItem>
                    <SelectItem value="400" disabled={role === 'free'}>400%</SelectItem>
                    <SelectItem value="600" disabled={role === 'free'}>600%</SelectItem>
                    <SelectItem value="800" disabled={role === 'free'}>800%</SelectItem>
                    <SelectItem value="1200" disabled={role === 'free'}>1200%</SelectItem>
                    <SelectItem value="1600" disabled={role === 'free'}>1600%</SelectItem>
                    <SelectItem value="2000" disabled={role === 'free'}>2000%</SelectItem>
                    {isPremium && <SelectItem value="unli">Unlimited</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Panel Type */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-muted-foreground">Tipe Panel</Label>
              <Select value={panelType} onValueChange={(v) => setPanelType(v as 'nodejs' | 'python')}>
                <SelectTrigger className="input-glass">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nodejs">Node.js</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {submitting ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  <span>Deploy Server Sekarang</span>
                </>
              )}
            </Button>
          </form>
        </GlassCard>

        {/* Footer */}
        <p className="text-center text-muted-foreground text-xs mt-8">
          &copy; 2026 Jhonaley Panel. All Rights Reserved.
        </p>
      </div>
    </div>
    </AppShell>
    </PageTransition>
  );
};

export default Dashboard;
