import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Server,
  HardDrive,
  Settings,
  ArrowLeft,
  Shield,
  Crown,
  UserCog,
  Trash2,
  Edit,
  Plus,
  Save,
  X,
  Eye,
  EyeOff,
  Search,
  AlertTriangle,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  Fingerprint,
  Globe,
  Megaphone,
} from 'lucide-react';
import AdminPagination from '@/components/AdminPagination';
import AdminPopupManager from '@/components/AdminPopupManager';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { PageTransition } from '@/components/PageTransition';
import AppShell from '@/components/AppShell';

import GlassCard from '@/components/GlassCard';
import StatCard from '@/components/StatCard';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import AccentColorPicker from '@/components/AccentColorPicker';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  panel_creations_count: number;
  created_at: string;
  role: AppRole;
  reseller_expires_at?: string | null;
  reseller_permanent?: boolean;
}

interface PterodactylServer {
  id: string;
  name: string;
  domain: string;
  plta_key: string;
  pltc_key: string;
  server_type: string;
  is_active: boolean;
  location_id: number;
  egg_id: number;
  python_egg_id?: number;
  nest_id?: number;
  created_at: string;
}

interface ServerStatus {
  serverId: string;
  isOnline: boolean;
  totalServers: number;
  totalUsers: number;
  error?: string;
}

interface UserPanel {
  id: string;
  user_id: string;
  username: string;
  email: string;
  login_url: string;
  ram: number;
  cpu: number;
  is_active: boolean;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  } | null;
}

interface DeviceRecord {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  ip_address: string | null;
  device_fingerprint: string | null;
  created_at: string;
}

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [servers, setServers] = useState<PterodactylServer[]>([]);
  const [panels, setPanels] = useState<UserPanel[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

  // Pagination & Search
  const ITEMS_PER_PAGE = 10;
  const [usersPage, setUsersPage] = useState(1);
  const [serversPage, setServersPage] = useState(1);
  const [panelsPage, setPanelsPage] = useState(1);
  const [devicesPage, setDevicesPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  // Stats
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalServers, setTotalServers] = useState(0);
  const [totalPanels, setTotalPanels] = useState(0);

  // Edit dialogs
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editingServer, setEditingServer] = useState<PterodactylServer | null>(null);
  const [newServer, setNewServer] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // Server status
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({});
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Clear all progress
  const [clearingProgress, setClearingProgress] = useState<{
    isClearing: boolean;
    total: number;
    current: number;
    deleted: number;
    failed: number;
    type: 'users' | 'panels';
  }>({ isClearing: false, total: 0, current: 0, deleted: 0, failed: 0, type: 'users' });

  // Server form state
  const [serverForm, setServerForm] = useState({
    name: '',
    domain: '',
    plta_key: '',
    pltc_key: '',
    server_type: 'public',
    location_id: 1,
    egg_id: 15,
    python_egg_id: 16,
    nest_id: 5,
  });

  // Filtered & paginated data
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.full_name?.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return servers;
    const q = searchQuery.toLowerCase();
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.domain.toLowerCase().includes(q) ||
        s.server_type.toLowerCase().includes(q)
    );
  }, [servers, searchQuery]);

  const filteredPanels = useMemo(() => {
    if (!searchQuery.trim()) return panels;
    const q = searchQuery.toLowerCase();
    return panels.filter(
      (p) =>
        p.username.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.login_url.toLowerCase().includes(q) ||
        (p.profiles?.email.toLowerCase().includes(q))
    );
  }, [panels, searchQuery]);

  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return devices;
    const q = searchQuery.toLowerCase();
    return devices.filter(
      (d) =>
        d.email.toLowerCase().includes(q) ||
        (d.full_name?.toLowerCase().includes(q)) ||
        (d.ip_address?.toLowerCase().includes(q)) ||
        (d.device_fingerprint?.toLowerCase().includes(q))
    );
  }, [devices, searchQuery]);

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredUsers, usersPage]);

  const paginatedServers = useMemo(() => {
    const start = (serversPage - 1) * ITEMS_PER_PAGE;
    return filteredServers.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredServers, serversPage]);

  const paginatedPanels = useMemo(() => {
    const start = (panelsPage - 1) * ITEMS_PER_PAGE;
    return filteredPanels.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPanels, panelsPage]);

  const paginatedDevices = useMemo(() => {
    const start = (devicesPage - 1) * ITEMS_PER_PAGE;
    return filteredDevices.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDevices, devicesPage]);

  // Reset page when search changes
  useEffect(() => {
    setUsersPage(1);
    setServersPage(1);
    setPanelsPage(1);
    setDevicesPage(1);
  }, [searchQuery]);

  // Jangan redirect saat auth masih loading (ini yang bikin "refresh"/bounce)
  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate('/auth');
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (authLoading || roleLoading) return;

    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Akses Ditolak',
        description: 'Anda tidak memiliki akses admin.',
      });
      navigate('/');
      return;
    }

    fetchAllData();
  }, [authLoading, isAdmin, roleLoading, navigate, toast]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchServers(), fetchPanels(), fetchDevices()]);
    setLoading(false);
  };

  // Check server statuses when servers change
  useEffect(() => {
    if (servers.length > 0 && !loading) {
      checkServerStatuses(servers);
    }
  }, [servers, loading]);

  // Auto-refresh server statuses every 30 seconds
  useEffect(() => {
    if (servers.length === 0) return;

    const interval = setInterval(() => {
      checkServerStatuses(servers);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [servers]);

  const fetchUsers = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        return {
          ...profile,
          role: (userRole?.role as AppRole) || 'free',
        };
      });

      setUsers(usersWithRoles);
      setTotalUsers(usersWithRoles.length);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('pterodactyl_servers')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setServers(data || []);
      setTotalServers(data?.length || 0);
    } catch (err) {
      console.error('Error fetching servers:', err);
    }
  };

  const checkServerStatuses = async (serverList?: PterodactylServer[]) => {
    const serversToCheck = serverList || servers;
    if (serversToCheck.length === 0) return;

    setCheckingStatus(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        console.error('No session for status check');
        return;
      }

      const response = await supabase.functions.invoke('check-server-status', {
        body: { serverIds: serversToCheck.map(s => s.id) },
      });

      if (response.error) {
        console.error('Error checking server status:', response.error);
        return;
      }

      const { statuses } = response.data;
      const statusMap: Record<string, ServerStatus> = {};
      statuses.forEach((status: ServerStatus) => {
        statusMap[status.serverId] = status;
      });

      setServerStatuses(statusMap);
    } catch (err) {
      console.error('Error checking server statuses:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const fetchPanels = async () => {
    try {
      // Fetch panels
      const { data: panelsData, error: panelsError } = await supabase
        .from('user_panels')
        .select('*')
        .order('created_at', { ascending: false });

      if (panelsError) throw panelsError;

      // Fetch profiles separately
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, email, full_name');

      // Merge panels with profiles
      const panelsWithProfiles = (panelsData || []).map(panel => {
        const profile = profilesData?.find(p => p.user_id === panel.user_id);
        return {
          ...panel,
          profiles: profile ? { email: profile.email, full_name: profile.full_name } : null,
        };
      });

      setPanels(panelsWithProfiles);
      setTotalPanels(panelsWithProfiles.length);
    } catch (err) {
      console.error('Error fetching panels:', err);
    }
  };

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, email, full_name, ip_address, device_fingerprint, created_at')
        .or('ip_address.neq.,device_fingerprint.neq.')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDevices((data || []).filter(d => d.ip_address || d.device_fingerprint) as DeviceRecord[]);
    } catch (err) {
      console.error('Error fetching devices:', err);
    }
  };

  const resetDeviceInfo = async (profileId: string, field: 'ip_address' | 'device_fingerprint' | 'both') => {
    try {
      const updateData: Record<string, null> = {};
      if (field === 'ip_address' || field === 'both') updateData.ip_address = null;
      if (field === 'device_fingerprint' || field === 'both') updateData.device_fingerprint = null;

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: field === 'both' ? 'IP & Fingerprint berhasil direset.' : `${field === 'ip_address' ? 'IP Address' : 'Fingerprint'} berhasil direset.`,
      });

      fetchDevices();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Gagal', description: err.message });
    }
  };

  const clearAllDeviceInfo = async () => {
    try {
      const ids = devices.map((d) => d.id);
      if (ids.length === 0) return;
      const { error } = await supabase
        .from('profiles')
        .update({ ip_address: null, device_fingerprint: null })
        .in('id', ids);
      if (error) throw error;
      toast({
        title: 'Berhasil',
        description: `${ids.length} IP & Fingerprint berhasil direset.`,
      });
      fetchDevices();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Gagal', description: err.message });
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Role pengguna berhasil diperbarui.',
      });

      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: err.message,
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal menghapus user');

      toast({
        title: 'Berhasil',
        description: 'Pengguna berhasil dihapus secara permanen.',
      });

      fetchUsers();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: err.message,
      });
    }
  };

  const saveServer = async () => {
    try {
      if (editingServer) {
        const { error } = await supabase
          .from('pterodactyl_servers')
          .update(serverForm)
          .eq('id', editingServer.id);

        if (error) throw error;
        toast({ title: 'Berhasil', description: 'Server berhasil diperbarui.' });
      } else {
        const { error } = await supabase
          .from('pterodactyl_servers')
          .insert(serverForm);

        if (error) throw error;
        toast({ title: 'Berhasil', description: 'Server baru berhasil ditambahkan.' });
      }

      setEditingServer(null);
      setNewServer(false);
      resetServerForm();
      fetchServers();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: err.message,
      });
    }
  };

  const deleteServer = async (serverId: string) => {
    try {
      const { error } = await supabase
        .from('pterodactyl_servers')
        .delete()
        .eq('id', serverId);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Server berhasil dihapus.',
      });

      fetchServers();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: err.message,
      });
    }
  };

  const deletePanel = async (panelId: string) => {
    try {
      // Get panel's user_id before deletion to reset their quota
      const panel = panels.find(p => p.id === panelId);
      
      const { error } = await supabase
        .from('user_panels')
        .delete()
        .eq('id', panelId);

      if (error) throw error;

      // Decrement panel_creations_count so user can create again
      if (panel?.user_id) {
        await (supabase.rpc as any)('decrement_panel_count', { _user_id: panel.user_id });
      }

      toast({
        title: 'Berhasil',
        description: 'Panel berhasil dihapus dan limit user dikembalikan.',
      });

      fetchPanels();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: err.message,
      });
    }
  };

  const clearAllNonAdminUsers = async () => {
    try {
      // Get all non-admin user IDs
      const nonAdminUsers = users.filter((u) => u.role !== 'admin');
      
      if (nonAdminUsers.length === 0) {
        toast({
          title: 'Info',
          description: 'Tidak ada akun non-admin untuk dihapus.',
        });
        return;
      }

      // Initialize progress
      setClearingProgress({
        isClearing: true,
        total: nonAdminUsers.length,
        current: 0,
        deleted: 0,
        failed: 0,
        type: 'users',
      });

      let deletedCount = 0;
      let failedCount = 0;
      let processedCount = 0;

      // Delete in parallel batches of 10 for speed
      const BATCH_SIZE = 10;
      
      for (let i = 0; i < nonAdminUsers.length; i += BATCH_SIZE) {
        const batch = nonAdminUsers.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const results = await Promise.all(
          batch.map(async (user) => {
            try {
              const { data, error } = await supabase.functions.invoke('delete-user', {
                body: { user_id: user.user_id },
              });
              if (error) return { error };
              if (data?.error) return { error: new Error(data.error) };
              return { error: null };
            } catch (e: any) {
              return { error: e };
            }
          })
        );

        // Count results
        results.forEach((result) => {
          processedCount++;
          if (result.error) {
            failedCount++;
          } else {
            deletedCount++;
          }
        });

        // Update progress after each batch
        setClearingProgress({
          isClearing: true,
          total: nonAdminUsers.length,
          current: processedCount,
          deleted: deletedCount,
          failed: failedCount,
          type: 'users',
        });
      }

      // Reset progress
      setClearingProgress({ isClearing: false, total: 0, current: 0, deleted: 0, failed: 0, type: 'users' });

      if (deletedCount > 0) {
        toast({
          title: 'Berhasil',
          description: `${deletedCount} akun non-admin berhasil dihapus.${failedCount > 0 ? ` ${failedCount} gagal.` : ''}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal',
          description: 'Tidak ada akun yang berhasil dihapus.',
        });
      }

      fetchAllData();
    } catch (err: any) {
      console.error('Clear all error:', err);
      setClearingProgress({ isClearing: false, total: 0, current: 0, deleted: 0, failed: 0, type: 'users' });
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: err.message,
      });
    }
  };

  const clearAllPanels = async () => {
    try {
      if (panels.length === 0) {
        toast({
          title: 'Info',
          description: 'Tidak ada panel untuk dihapus.',
        });
        return;
      }

      // Initialize progress
      setClearingProgress({
        isClearing: true,
        total: panels.length,
        current: 0,
        deleted: 0,
        failed: 0,
        type: 'panels',
      });

      let deletedCount = 0;
      let failedCount = 0;
      let processedCount = 0;

      // Delete in parallel batches of 10 for speed
      const BATCH_SIZE = 10;
      
      for (let i = 0; i < panels.length; i += BATCH_SIZE) {
        const batch = panels.slice(i, i + BATCH_SIZE);
        
        // Process batch in parallel
        const results = await Promise.all(
          batch.map(async (panel) => {
            const { error } = await supabase
              .from('user_panels')
              .delete()
              .eq('id', panel.id);
            return { error };
          })
        );

        // Count results
        results.forEach((result) => {
          processedCount++;
          if (result.error) {
            failedCount++;
          } else {
            deletedCount++;
          }
        });

        // Update progress after each batch
        setClearingProgress({
          isClearing: true,
          total: panels.length,
          current: processedCount,
          deleted: deletedCount,
          failed: failedCount,
          type: 'panels',
        });
      }

      // Reset progress
      setClearingProgress({ isClearing: false, total: 0, current: 0, deleted: 0, failed: 0, type: 'panels' });

      if (deletedCount > 0) {
        toast({
          title: 'Berhasil',
          description: `${deletedCount} panel berhasil dihapus.${failedCount > 0 ? ` ${failedCount} gagal.` : ''}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal',
          description: 'Tidak ada panel yang berhasil dihapus.',
        });
      }

      fetchAllData();
    } catch (err: any) {
      console.error('Clear all panels error:', err);
      setClearingProgress({ isClearing: false, total: 0, current: 0, deleted: 0, failed: 0, type: 'panels' });
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: err.message,
      });
    }
  };

  const resetServerForm = () => {
    setServerForm({
      name: '',
      domain: '',
      plta_key: '',
      pltc_key: '',
      server_type: 'public',
      location_id: 1,
      egg_id: 15,
      python_egg_id: 16,
      nest_id: 5,
    });
  };

  const openEditServer = (server: PterodactylServer) => {
    setEditingServer(server);
    setServerForm({
      name: server.name,
      domain: server.domain,
      plta_key: server.plta_key,
      pltc_key: server.pltc_key,
      server_type: server.server_type,
      location_id: server.location_id,
      egg_id: server.egg_id,
      python_egg_id: server.python_egg_id ?? 16,
      nest_id: server.nest_id ?? 5,
    });
  };

  const getRoleBadgeColor = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return 'bg-amber/20 text-amber border-amber/30';
      case 'reseller':
        return 'bg-purple/20 text-purple border-purple/30';
      case 'premium':
        return 'bg-primary/20 text-primary border-primary/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  if (authLoading || roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card rounded-2xl p-8">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground mt-4">Memuat data admin...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
    <PageTransition>
    <div className="min-h-screen py-6 px-4 bg-background">

      <div className="w-full max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <GlassCard className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber to-amber/50 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-background" />
                </div>
                <div>
                  <h1 className="font-bold text-lg">Admin Panel</h1>
                  <p className="text-xs text-muted-foreground">Kelola pengguna & server</p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Tabs */}
        <GlassCard className="p-6" delay={0.3}>
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari user, server, atau panel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-glass pl-10"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 bg-secondary/50 mb-6">
              <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Pengguna</span> ({filteredUsers.length})
              </TabsTrigger>
              <TabsTrigger value="servers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Server className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Server</span> ({filteredServers.length})
              </TabsTrigger>
              <TabsTrigger value="panels" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <HardDrive className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Panel</span> ({filteredPanels.length})
              </TabsTrigger>
              <TabsTrigger value="devices" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Fingerprint className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Device</span>
              </TabsTrigger>
              <TabsTrigger value="popup" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Megaphone className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Popup</span>
              </TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users">
              {/* Progress Dialog - shared for users and panels */}
              <Dialog open={clearingProgress.isClearing}>
                <DialogContent className="bg-card border border-border rounded-xl sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-destructive animate-pulse" />
                      {clearingProgress.type === 'users' ? 'Menghapus Akun...' : 'Menghapus Panel...'}
                    </DialogTitle>
                    <DialogDescription>
                      Mohon tunggu, proses penghapusan sedang berlangsung.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {clearingProgress.current} / {clearingProgress.total}
                        </span>
                      </div>
                      <div className="h-3 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-destructive to-destructive/70"
                          initial={{ width: 0 }}
                          animate={{ 
                            width: `${(clearingProgress.current / clearingProgress.total) * 100}%` 
                          }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <div className="text-center text-sm font-medium">
                        {Math.round((clearingProgress.current / clearingProgress.total) * 100)}%
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-green-500">{clearingProgress.deleted}</div>
                        <div className="text-xs text-muted-foreground">Berhasil</div>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-500">{clearingProgress.failed}</div>
                        <div className="text-xs text-muted-foreground">Gagal</div>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Clear All Button */}
              <div className="flex justify-end mb-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="gap-2"
                      disabled={users.filter((u) => u.role !== 'admin').length === 0 || clearingProgress.isClearing}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Clear All ({users.filter((u) => u.role !== 'admin').length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border border-border rounded-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-5 h-5" />
                        Hapus Semua Akun Non-Admin?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Tindakan ini akan menghapus <strong>{users.filter((u) => u.role !== 'admin').length}</strong> akun beserta semua panel mereka. 
                        Akun admin akan tetap aman. Tindakan ini tidak dapat dibatalkan!
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={clearAllNonAdminUsers}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Hapus Semua
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Email</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Masa Aktif</TableHead>
                      <TableHead>Panel</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {searchQuery ? 'Tidak ada hasil pencarian' : 'Belum ada data'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedUsers.map((u) => (
                        <TableRow key={u.id} className="border-border/30">
                          <TableCell className="font-mono text-sm">{u.email}</TableCell>
                          <TableCell>{u.full_name || '-'}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(u.role)}`}>
                              {u.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            {u.role === 'admin' ? (
                              <span className="text-xs text-emerald-400 font-semibold">∞ Admin</span>
                            ) : u.role !== 'reseller' && u.role !== 'premium' ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : u.reseller_permanent ? (
                              <span className="text-xs text-emerald-400 font-semibold">∞ Permanen</span>
                            ) : u.reseller_expires_at ? (
                              (() => {
                                const exp = new Date(u.reseller_expires_at).getTime();
                                const daysLeft = Math.max(
                                  0,
                                  Math.ceil((exp - Date.now()) / 86400000),
                                );
                                const expired = exp < Date.now();
                                return (
                                  <div className="flex flex-col">
                                    <span
                                      className={`text-xs font-semibold ${
                                        expired
                                          ? 'text-destructive'
                                          : daysLeft <= 2
                                          ? 'text-rose-400'
                                          : daysLeft <= 7
                                          ? 'text-amber'
                                          : 'text-foreground'
                                      }`}
                                    >
                                      {expired ? 'Expired' : `${daysLeft} hari lagi`}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">
                                      {new Date(u.reseller_expires_at).toLocaleString('id-ID', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </div>
                                );
                              })()
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{u.panel_creations_count}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingUser(u)}
                                  >
                                    <UserCog className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="bg-card border border-border rounded-xl">
                                  <DialogHeader>
                                    <DialogTitle>Edit Role Pengguna</DialogTitle>
                                    <DialogDescription>
                                      Ubah role untuk {u.email}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="py-4">
                                    <Label>Role</Label>
                                    <Select
                                      defaultValue={u.role}
                                      onValueChange={(val) => updateUserRole(u.user_id, val as AppRole)}
                                    >
                                      <SelectTrigger className="input-glass mt-2">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="free">Free</SelectItem>
                                        <SelectItem value="premium">Premium</SelectItem>
                                        <SelectItem value="reseller">Reseller</SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-card border border-border rounded-xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Pengguna?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Yakin hapus {u.email}? Semua panel akan ikut terhapus.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteUser(u.user_id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Hapus
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <AdminPagination
                  currentPage={usersPage}
                  totalPages={Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)}
                  onPageChange={setUsersPage}
                  totalItems={filteredUsers.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                />
              </div>
            </TabsContent>

            {/* Servers Tab */}
            <TabsContent value="servers">
              <div className="flex justify-between items-center mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => checkServerStatuses()}
                  disabled={checkingStatus}
                  className="gap-2"
                >
                  {checkingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Refresh Status
                </Button>

                <Dialog open={newServer || !!editingServer} onOpenChange={(open) => {
                  if (!open) {
                    setNewServer(false);
                    setEditingServer(null);
                    resetServerForm();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        resetServerForm();
                        setNewServer(true);
                      }}
                      className="btn-primary"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Tambah Server
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border border-border rounded-xl max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        {editingServer ? 'Edit Server' : 'Tambah Server Baru'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 py-4">
                      <div className="space-y-2">
                        <Label>Nama Server</Label>
                        <Input
                          value={serverForm.name}
                          onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })}
                          className="input-glass"
                          placeholder="Server 1 (Public)"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Domain</Label>
                        <Input
                          value={serverForm.domain}
                          onChange={(e) => setServerForm({ ...serverForm, domain: e.target.value })}
                          className="input-glass"
                          placeholder="https://panel.example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>PLTA Key</Label>
                        <Input
                          value={serverForm.plta_key}
                          onChange={(e) => setServerForm({ ...serverForm, plta_key: e.target.value })}
                          className="input-glass"
                          placeholder="ptla_xxx"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>PLTC Key</Label>
                        <Input
                          value={serverForm.pltc_key}
                          onChange={(e) => setServerForm({ ...serverForm, pltc_key: e.target.value })}
                          className="input-glass"
                          placeholder="ptlc_xxx"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Tipe</Label>
                          <Select
                            value={serverForm.server_type}
                            onValueChange={(val) => setServerForm({ ...serverForm, server_type: val })}
                          >
                            <SelectTrigger className="input-glass">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="public">Public</SelectItem>
                              <SelectItem value="private">Private</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Location ID</Label>
                          <Input
                            type="number"
                            value={serverForm.location_id}
                            onChange={(e) => setServerForm({ ...serverForm, location_id: parseInt(e.target.value) })}
                            className="input-glass"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Egg ID (Node.js)</Label>
                          <Input
                            type="number"
                            value={serverForm.egg_id}
                            onChange={(e) => setServerForm({ ...serverForm, egg_id: parseInt(e.target.value) })}
                            className="input-glass"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Egg ID (Python)</Label>
                          <Input
                            type="number"
                            value={serverForm.python_egg_id}
                            onChange={(e) => setServerForm({ ...serverForm, python_egg_id: parseInt(e.target.value) || 0 })}
                            className="input-glass"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nest ID</Label>
                          <Input
                            type="number"
                            value={serverForm.nest_id}
                            onChange={(e) => setServerForm({ ...serverForm, nest_id: parseInt(e.target.value) || 0 })}
                            className="input-glass"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setNewServer(false);
                        setEditingServer(null);
                        resetServerForm();
                      }}>
                        Batal
                      </Button>
                      <Button onClick={saveServer} className="btn-primary">
                        <Save className="w-4 h-4 mr-2" />
                        Simpan
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Status</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Panels</TableHead>
                      <TableHead>PLTA Key</TableHead>
                      <TableHead>PLTC Key</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedServers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          {searchQuery ? 'Tidak ada hasil pencarian' : 'Belum ada data'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedServers.map((server) => {
                        const status = serverStatuses[server.id];
                        return (
                          <TableRow key={server.id} className="border-border/30">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {checkingStatus && !status ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                ) : status?.isOnline ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="relative flex h-2.5 w-2.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                    </span>
                                    <span className="text-xs text-green-500 font-medium">Online</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                                    <span className="text-xs text-red-500 font-medium">Offline</span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{server.name}</TableCell>
                            <TableCell className="font-mono text-sm text-primary">{server.domain}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                server.server_type === 'private' 
                                  ? 'bg-purple/20 text-purple' 
                                  : 'bg-emerald/20 text-emerald'
                              }`}>
                                {server.server_type}
                              </span>
                            </TableCell>
                            <TableCell>
                              {status?.isOnline ? (
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium">{status.totalServers} panel</span>
                                  <span className="text-xs text-muted-foreground">{status.totalUsers} user</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-xs ${showKeys[`plta-${server.id}`] ? '' : 'blur-sm'}`}>
                                {server.plta_key.slice(0, 15)}...
                              </span>
                              <button
                                onClick={() => setShowKeys(prev => ({
                                  ...prev,
                                  [`plta-${server.id}`]: !prev[`plta-${server.id}`]
                                }))}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {showKeys[`plta-${server.id}`] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={`font-mono text-xs ${showKeys[`pltc-${server.id}`] ? '' : 'blur-sm'}`}>
                                {server.pltc_key.slice(0, 15)}...
                              </span>
                              <button
                                onClick={() => setShowKeys(prev => ({
                                  ...prev,
                                  [`pltc-${server.id}`]: !prev[`pltc-${server.id}`]
                                }))}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                {showKeys[`pltc-${server.id}`] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditServer(server)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-card border border-border rounded-xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Server?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Yakin hapus "{server.name}"? Ini bisa mempengaruhi panel yang menggunakannya.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteServer(server.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Hapus
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                <AdminPagination
                  currentPage={serversPage}
                  totalPages={Math.ceil(filteredServers.length / ITEMS_PER_PAGE)}
                  onPageChange={setServersPage}
                  totalItems={filteredServers.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                />
              </div>
            </TabsContent>

            {/* Panels Tab */}
            <TabsContent value="panels">
              {/* Clear All Panels Button */}
              <div className="flex justify-end mb-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="gap-2"
                      disabled={panels.length === 0 || clearingProgress.isClearing}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Clear All Panels ({panels.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border border-border rounded-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-5 h-5" />
                        Hapus Semua Panel?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Tindakan ini akan menghapus <strong>{panels.length}</strong> panel dari database. 
                        Tindakan ini tidak dapat dibatalkan!
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={clearAllPanels}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Hapus Semua
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Username</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Login URL</TableHead>
                      <TableHead>RAM</TableHead>
                      <TableHead>CPU</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPanels.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {searchQuery ? 'Tidak ada hasil pencarian' : 'Belum ada data'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPanels.map((panel) => (
                        <TableRow key={panel.id} className="border-border/30">
                          <TableCell className="font-mono">{panel.username}</TableCell>
                          <TableCell>{panel.profiles?.email || panel.email || '-'}</TableCell>
                          <TableCell className="text-primary text-sm">{panel.login_url}</TableCell>
                          <TableCell>{panel.ram === 0 ? '∞' : `${panel.ram}MB`}</TableCell>
                          <TableCell>{panel.cpu === 0 ? '∞' : `${panel.cpu}%`}</TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="bg-card border border-border rounded-xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Panel?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Yakin hapus panel "{panel.username}"?
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deletePanel(panel.id)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <AdminPagination
                  currentPage={panelsPage}
                  totalPages={Math.ceil(filteredPanels.length / ITEMS_PER_PAGE)}
                  onPageChange={setPanelsPage}
                  totalItems={filteredPanels.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                />
              </div>
            </TabsContent>

            {/* Devices Tab */}
            <TabsContent value="devices">
              {/* Clear All IP & Fingerprint Button */}
              <div className="flex justify-end mb-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="gap-2"
                      disabled={devices.length === 0}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Clear All IP ({devices.length})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border border-border rounded-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-5 h-5" />
                        Reset Semua IP & Fingerprint?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Tindakan ini akan mereset IP Address & Device Fingerprint dari{' '}
                        <strong>{devices.length}</strong> pengguna. Mereka akan bisa mendaftar
                        akun baru lagi. Tindakan ini tidak dapat dibatalkan!
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={clearAllDeviceInfo}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Reset Semua
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50">
                      <TableHead>Email</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Fingerprint</TableHead>
                      <TableHead>Terdaftar</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedDevices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {searchQuery ? 'Tidak ada hasil pencarian' : 'Belum ada data device'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedDevices.map((device) => (
                        <TableRow key={device.id} className="border-border/30">
                          <TableCell className="font-mono text-sm">{device.email}</TableCell>
                          <TableCell>{device.full_name || '-'}</TableCell>
                          <TableCell>
                            {device.ip_address ? (
                              <div className="flex items-center gap-1.5">
                                <Globe className="w-3 h-3 text-primary" />
                                <span className="font-mono text-sm">{device.ip_address}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {device.device_fingerprint ? (
                              <div className="flex items-center gap-1.5">
                                <Fingerprint className="w-3 h-3 text-primary" />
                                <span className="font-mono text-xs">{device.device_fingerprint.slice(0, 12)}...</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(device.created_at).toLocaleDateString('id-ID')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {device.ip_address && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-xs gap-1">
                                      <Globe className="w-3 h-3" />
                                      Reset IP
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-card border border-border rounded-xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Reset IP Address?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        IP <strong>{device.ip_address}</strong> milik {device.email} akan direset. User dengan IP ini bisa mendaftar lagi.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Batal</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => resetDeviceInfo(device.id, 'ip_address')}>
                                        Reset
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {device.device_fingerprint && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-xs gap-1">
                                      <Fingerprint className="w-3 h-3" />
                                      Reset FP
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-card border border-border rounded-xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Reset Fingerprint?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Fingerprint milik {device.email} akan direset. Perangkat ini bisa mendaftar lagi.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Batal</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => resetDeviceInfo(device.id, 'device_fingerprint')}>
                                        Reset
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {(device.ip_address || device.device_fingerprint) && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-xs gap-1 text-destructive">
                                      <Trash2 className="w-3 h-3" />
                                      Reset All
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="bg-card border border-border rounded-xl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Reset Semua Data Device?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        IP & Fingerprint milik {device.email} akan direset. Perangkat ini bisa mendaftar ulang.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Batal</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => resetDeviceInfo(device.id, 'both')}
                                        className="bg-destructive hover:bg-destructive/90"
                                      >
                                        Reset Semua
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <AdminPagination
                  currentPage={devicesPage}
                  totalPages={Math.ceil(filteredDevices.length / ITEMS_PER_PAGE)}
                  onPageChange={setDevicesPage}
                  totalItems={filteredDevices.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                />
              </div>
            </TabsContent>

            {/* Popup Tab */}
            <TabsContent value="popup">
              <AdminPopupManager />
            </TabsContent>
          </Tabs>
        </GlassCard>

        {/* Footer */}
        <p className="text-center text-muted-foreground text-xs mt-8">
          Admin Panel &copy; 2026 Jhonaley Panel
        </p>
      </div>
    </div>
    </PageTransition>
    </AppShell>
  );
};

export default Admin;
