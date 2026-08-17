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
  Sparkles,
  ScrollText,
  Bell,
  Tag,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { UserX } from 'lucide-react';
import AdminPagination from '@/components/AdminPagination';
import AdminLayout from '@/components/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import GlassCard from '@/components/GlassCard';
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
import ProcessLogDialog from '@/components/ProcessLogDialog';

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
  adp_server_expires_at?: string | null;
  adp_server_permanent?: boolean;
}

interface PterodactylServer {
  id: string;
  name: string;
  domain: string;
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

type UserPanelRow = Omit<UserPanel, 'profiles'>;

interface DeviceRecord {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  ip_address: string | null;
  device_fingerprint: string | null;
  created_at: string;
}

const ADMIN_PAGE_SIZE = 1000;

const fetchAllAdminRows = async <T,>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>
): Promise<T[]> => {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery(from, from + ADMIN_PAGE_SIZE - 1);
    if (error) throw error;

    const batch = (data || []) as T[];
    allRows.push(...batch);

    if (batch.length < ADMIN_PAGE_SIZE) break;
    from += ADMIN_PAGE_SIZE;
  }

  return allRows;
};

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
  const [editRole, setEditRole] = useState<AppRole>('free');
  const [editDuration, setEditDuration] = useState<'30' | '60' | '90' | 'perm'>('perm');
  const [editingServer, setEditingServer] = useState<PterodactylServer | null>(null);
  const [newServer, setNewServer] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // Server status
  const [serverStatuses, setServerStatuses] = useState<Record<string, ServerStatus>>({});

  // Process logs viewer for delete-panel
  const [processLogs, setProcessLogs] = useState<string[]>([]);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [logDialogSuccess, setLogDialogSuccess] = useState(true);
  const [logDialogTitle, setLogDialogTitle] = useState('Log Hapus Panel');
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
    plta_share_key: '',
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
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true });

      const profiles = await fetchAllAdminRows<Omit<UserWithRole, 'role'>>((from, to) =>
        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to)
      );

      const roles = await fetchAllAdminRows<{ user_id: string; role: AppRole }>((from, to) =>
        supabase
          .from('user_roles')
          .select('user_id, role')
          .range(from, to)
      );

      const rolesByUserId = new Map(roles.map((role) => [role.user_id, role.role]));

      const usersWithRoles: UserWithRole[] = profiles.map((profile) => {
        return {
          ...profile,
          role: rolesByUserId.get(profile.user_id) || 'free',
        };
      });

      setUsers(usersWithRoles);
      setTotalUsers(count ?? usersWithRoles.length);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('pterodactyl_servers')
        .select('id, name, domain, server_type, is_active, location_id, egg_id, python_egg_id, nest_id, created_at')
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
      const panelsData = await fetchAllAdminRows<UserPanelRow>((from, to) =>
        supabase
          .from('user_panels')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, to)
      );

      const profilesData = await fetchAllAdminRows<Pick<DeviceRecord, 'user_id' | 'email' | 'full_name'>>((from, to) =>
        supabase
          .from('profiles')
          .select('user_id, email, full_name')
          .range(from, to)
      );

      const profilesByUserId = new Map(profilesData.map((profile) => [profile.user_id, profile]));

      // Merge panels with profiles
      const panelsWithProfiles = panelsData.map(panel => {
        const profile = profilesByUserId.get(panel.user_id);
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
      const data = await fetchAllAdminRows<DeviceRecord>((from, to) =>
        supabase
          .from('profiles')
          .select('id, user_id, email, full_name, ip_address, device_fingerprint, created_at')
          .or('ip_address.neq.,device_fingerprint.neq.')
          .order('created_at', { ascending: false })
          .range(from, to)
      );

      setDevices(data.filter(d => d.ip_address || d.device_fingerprint));
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

  const updateUserRole = async (
    userId: string,
    newRole: AppRole,
    duration?: '30' | '60' | '90' | 'perm',
  ) => {
    try {
      // Replace any existing role row (handles users with no row yet, e.g. still 'free')
      const { error: delErr } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });
      if (insErr) throw insErr;

      const patch: Record<string, unknown> = {};

      // Apply duration to profile columns for reseller / adp_server,
      // and always clear the opposite tier so old permanent badges/status don't stick after switching roles.
      if (duration && (newRole === 'reseller' || newRole === 'adp_server')) {
        const permanent = duration === 'perm';
        const expiresAt = permanent
          ? null
          : new Date(Date.now() + parseInt(duration) * 86400000).toISOString();

        if (newRole === 'adp_server') {
          patch.adp_server_permanent = permanent;
          patch.adp_server_expires_at = expiresAt;
          patch.reseller_permanent = false;
          patch.reseller_expires_at = null;
        } else {
          patch.reseller_permanent = permanent;
          patch.reseller_expires_at = expiresAt;
          patch.adp_server_permanent = false;
          patch.adp_server_expires_at = null;
        }
      } else {
        // Clear tier-specific expiry columns when role no longer grants them
        if (newRole !== 'reseller') {
          patch.reseller_permanent = false;
          patch.reseller_expires_at = null;
        }
        if (newRole !== 'adp_server') {
          patch.adp_server_permanent = false;
          patch.adp_server_expires_at = null;
        }
      }

      if (Object.keys(patch).length > 0) {
        const { error: pErr } = await supabase
          .from('profiles')
          .update(patch)
          .eq('user_id', userId);
        if (pErr) throw pErr;
      }

      toast({
        title: 'Berhasil',
        description:
          duration && duration !== 'perm'
            ? `Role diperbarui, aktif ${duration} hari.`
            : duration === 'perm'
            ? 'Role diperbarui, aktif permanen.'
            : 'Role pengguna berhasil diperbarui.',
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
      const { data, error } = await supabase.functions.invoke('manage-server', {
        body: editingServer
          ? { action: 'update', id: editingServer.id, ...serverForm }
          : { action: 'create', ...serverForm },
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || 'Gagal menyimpan server');
      toast({
        title: 'Berhasil',
        description: editingServer ? 'Server berhasil diperbarui.' : 'Server baru berhasil ditambahkan.',
      });

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
      const { data, error } = await supabase.functions.invoke('manage-server', {
        body: { action: 'delete', id: serverId },
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || 'Gagal menghapus server');

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
      // Use edge function so Pterodactyl server + user are also deleted
      const { data, error } = await supabase.functions.invoke('delete-panel', {
        body: { panelId },
      });
      if (error) throw error;
      if (!data?.success) {
        setLogDialogTitle('Log Hapus Panel');
        setProcessLogs(Array.isArray(data?.logs) ? data.logs : []);
        setLogDialogSuccess(false);
        setLogDialogOpen(true);
        throw new Error(data?.error || 'Gagal menghapus panel');
      }

      setLogDialogTitle('Log Hapus Panel');
      setProcessLogs(Array.isArray(data?.logs) ? data.logs : []);
      setLogDialogSuccess(true);
      setLogDialogOpen(true);

      toast({
        title: 'Berhasil',
        description: data?.message || 'Panel berhasil dihapus.',
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
      const allLogs: string[] = [];

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

  const clearAllPanels = async (targetPanels: UserPanel[] = panels, label = 'panel') => {
    try {
      if (targetPanels.length === 0) {
        toast({
          title: 'Info',
          description: `Tidak ada ${label} untuk dihapus.`,
        });
        return;
      }

      // Initialize progress
      setClearingProgress({
        isClearing: true,
        total: targetPanels.length,
        current: 0,
        deleted: 0,
        failed: 0,
        type: 'panels',
      });

      let deletedCount = 0;
      let failedCount = 0;
      let processedCount = 0;
      const allLogs: string[] = [];

      // Open live log dialog from the start
      setLogDialogTitle(`Menghapus ${targetPanels.length} ${label}...`);
      setProcessLogs([`Mulai menghapus ${targetPanels.length} ${label} (batch 10 paralel)...`, '']);
      setLogDialogSuccess(true);
      setLogDialogOpen(true);

      // Delete in parallel batches of 10 for speed
      const BATCH_SIZE = 10;
      
      for (let i = 0; i < targetPanels.length; i += BATCH_SIZE) {
        const batch = targetPanels.slice(i, i + BATCH_SIZE);
        allLogs.push(`--- Batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} panel) ---`);
        setProcessLogs([...allLogs]);
        
        // Process batch in parallel
        const results = await Promise.all(
          batch.map(async (panel) => {
            try {
              const { data, error } = await supabase.functions.invoke('delete-panel', {
                body: { panelId: panel.id },
              });
              const logs: string[] = Array.isArray(data?.logs) ? data.logs : [];
              if (error) return { error, panel, logs };
              if (!data?.success) return { error: new Error(data?.error || 'failed'), panel, logs };
              return { error: null, panel, logs };
            } catch (e: any) {
              return { error: e, panel, logs: [] as string[] };
            }
          })
        );

        // Count results
        results.forEach((result) => {
          processedCount++;
          const header = `===== ${result.panel.username} (${result.panel.id.slice(0, 8)}) — ${result.error ? 'GAGAL' : 'OK'} =====`;
          allLogs.push(header);
          if (result.logs && result.logs.length > 0) allLogs.push(...result.logs);
          if (result.error) allLogs.push(`ERROR: ${result.error.message || result.error}`);
          allLogs.push('');
          if (result.error) {
            failedCount++;
          } else {
            deletedCount++;
          }
        });

        // Live update logs + progress after each batch
        setProcessLogs([...allLogs]);
        setLogDialogTitle(`Menghapus ${label}... ${processedCount}/${targetPanels.length} (OK ${deletedCount} / Gagal ${failedCount})`);

        // Update progress after each batch
        setClearingProgress({
          isClearing: true,
          total: targetPanels.length,
          current: processedCount,
          deleted: deletedCount,
          failed: failedCount,
          type: 'panels',
        });
      }

      // Reset progress
      setClearingProgress({ isClearing: false, total: 0, current: 0, deleted: 0, failed: 0, type: 'panels' });

      // Finalize log dialog title + status
      allLogs.push(`=== SELESAI: ${deletedCount} berhasil, ${failedCount} gagal ===`);
      setProcessLogs([...allLogs]);
      setLogDialogTitle(`Selesai — ${deletedCount} OK / ${failedCount} gagal`);
      setLogDialogSuccess(failedCount === 0);

      if (deletedCount > 0) {
        toast({
          title: 'Berhasil',
          description: `${deletedCount} ${label} berhasil dihapus.${failedCount > 0 ? ` ${failedCount} gagal.` : ''}`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Gagal',
          description: `Tidak ada ${label} yang berhasil dihapus.`,
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
      plta_share_key: '',
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
      plta_key: '',
      plta_share_key: '',
      pltc_key: '',
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
    <AdminLayout title="Manajemen Data" description="Kelola pengguna, server, panel & device dalam satu tempat">
        <GlassCard className="p-4 sm:p-6" delay={0.3}>
          {/* Search Bar */}
          <div className="relative mb-5">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari user, server, atau panel..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-glass pl-10 h-11"
            />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Scrollable tab nav */}
            <div className="relative -mx-4 sm:-mx-6 mb-6 border-b border-border/50 overflow-x-auto scrollbar-none touch-pan-x overscroll-x-contain">
              <TabsList className="h-auto p-0 bg-transparent inline-flex w-max gap-1 px-4 sm:px-6">
                {[
                  { value: 'users', icon: Users, label: 'Pengguna', count: filteredUsers.length },
                  { value: 'servers', icon: Server, label: 'Server', count: filteredServers.length },
                  { value: 'panels', icon: HardDrive, label: 'Panel', count: filteredPanels.length },
                  { value: 'devices', icon: Fingerprint, label: 'Device' },
                ].map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="relative shrink-0 h-10 px-3.5 rounded-none border-b-2 border-transparent bg-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-primary data-[state=active]:shadow-none transition-all"
                  >
                    <t.icon className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">{t.label}</span>
                    {typeof t.count === 'number' && (
                      <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-secondary text-foreground/70 data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
                        {t.count}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

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
                                    onClick={() => {
                                      setEditingUser(u);
                                      setEditRole(u.role as AppRole);
                                      setEditDuration(
                                        u.role === 'adp_server'
                                          ? 'perm'
                                          : u.reseller_permanent
                                          ? 'perm'
                                          : '30',
                                      );
                                    }}
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
                                  <div className="py-4 space-y-4">
                                   <div>
                                    <Label>Role</Label>
                                    <Select
                                      value={editRole}
                                      onValueChange={(val) => setEditRole(val as AppRole)}
                                    >
                                      <SelectTrigger className="input-glass mt-2">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="free">Free</SelectItem>
                                        <SelectItem value="reseller">Reseller</SelectItem>
                                        <SelectItem value="adp_server">
                                          Admin Panel Server (adp_server)
                                        </SelectItem>
                                        <SelectItem value="admin">Admin</SelectItem>
                                      </SelectContent>
                                    </Select>
                                   </div>

                                   {(editRole === 'reseller' || editRole === 'adp_server') && (
                                     <div>
                                       <Label>Durasi Aktif</Label>
                                       <Select
                                         value={editDuration}
                                         onValueChange={(val) => setEditDuration(val as any)}
                                       >
                                         <SelectTrigger className="input-glass mt-2">
                                           <SelectValue />
                                         </SelectTrigger>
                                         <SelectContent>
                                           <SelectItem value="30">1 Bulan (30 hari)</SelectItem>
                                           <SelectItem value="60">2 Bulan (60 hari)</SelectItem>
                                           <SelectItem value="90">3 Bulan (90 hari)</SelectItem>
                                           <SelectItem value="perm">Permanen ∞</SelectItem>
                                         </SelectContent>
                                       </Select>
                                       <p className="text-[11px] text-muted-foreground mt-1.5">
                                         Aktif sampai:{' '}
                                         <span className="text-foreground font-semibold">
                                           {editDuration === 'perm'
                                             ? 'Selamanya'
                                             : new Date(
                                                 Date.now() + parseInt(editDuration) * 86400000,
                                               ).toLocaleString('id-ID', {
                                                 day: '2-digit',
                                                 month: 'short',
                                                 year: 'numeric',
                                                 hour: '2-digit',
                                                 minute: '2-digit',
                                               })}
                                         </span>
                                       </p>
                                     </div>
                                   )}

                                   <div className="flex justify-end gap-2 pt-2">
                                     <Button
                                       variant="outline"
                                       onClick={() => setEditingUser(null)}
                                     >
                                       Batal
                                     </Button>
                                     <Button
                                       className="btn-primary"
                                       onClick={() =>
                                         updateUserRole(
                                           u.user_id,
                                           editRole,
                                           editRole === 'reseller' || editRole === 'adp_server'
                                             ? editDuration
                                             : undefined,
                                         )
                                       }
                                     >
                                       Simpan
                                     </Button>
                                   </div>
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
                        <Label>PLTA Key — Create {editingServer && <span className="text-xs text-muted-foreground">(kosongkan untuk tetap)</span>}</Label>
                        <Input
                          type="password"
                          value={serverForm.plta_key}
                          onChange={(e) => setServerForm({ ...serverForm, plta_key: e.target.value })}
                          className="input-glass"
                          placeholder={editingServer ? '•••••••••••• (tidak ditampilkan)' : 'ptla_xxx'}
                        />
                        <p className="text-xs text-muted-foreground">Dipakai sistem untuk membuat user/panel. Tidak dibagikan ke pengguna.</p>
                      </div>
                      <div className="space-y-2">
                        <Label>PLTA Key — Dibagikan ke Pengguna {editingServer && <span className="text-xs text-muted-foreground">(kosongkan untuk tetap)</span>}</Label>
                        <Input
                          type="password"
                          value={serverForm.plta_share_key}
                          onChange={(e) => setServerForm({ ...serverForm, plta_share_key: e.target.value })}
                          className="input-glass"
                          placeholder={editingServer ? '•••••••••••• (tidak ditampilkan)' : 'ptla_xxx (opsional)'}
                        />
                        <p className="text-xs text-muted-foreground">Kunci yang diberikan ke pengguna saat membuat Admin Panel. Jika kosong, memakai PLTA Create.</p>
                      </div>
                      <div className="space-y-2">
                        <Label>PLTC Key {editingServer && <span className="text-xs text-muted-foreground">(kosongkan untuk tetap)</span>}</Label>
                        <Input
                          type="password"
                          value={serverForm.pltc_key}
                          onChange={(e) => setServerForm({ ...serverForm, pltc_key: e.target.value })}
                          className="input-glass"
                          placeholder={editingServer ? '•••••••••••• (tidak ditampilkan)' : 'ptlc_xxx'}
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
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedServers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
              {/* Clear Panels Buttons */}
              <div className="flex flex-wrap justify-end gap-2 mb-4">
                {(() => {
                  const freeUserIds = new Set(users.filter((u) => u.role === 'free').map((u) => u.user_id));
                  const freePanels = panels.filter((p) => freeUserIds.has(p.user_id));
                  return (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                          disabled={freePanels.length === 0 || clearingProgress.isClearing}
                        >
                          <AlertTriangle className="w-4 h-4" />
                          Clear Free Panels ({freePanels.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border border-border rounded-xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="w-5 h-5" />
                            Hapus Semua Panel Free?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Tindakan ini akan menghapus <strong>{freePanels.length}</strong> panel milik user role <strong>free</strong> dari database dan server Pterodactyl.
                            Tindakan ini tidak dapat dibatalkan!
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => clearAllPanels(freePanels, 'panel free')}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Hapus Free Panels
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  );
                })()}
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
                        onClick={() => clearAllPanels()}
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

          </Tabs>
        </GlassCard>

    <ProcessLogDialog
      open={logDialogOpen}
      onOpenChange={setLogDialogOpen}
      title={logDialogTitle}
      description="Detail langkah eksekusi pada Pterodactyl dan database."
      logs={processLogs}
      success={logDialogSuccess}
    />
    </AdminLayout>
  );
};

export default Admin;
