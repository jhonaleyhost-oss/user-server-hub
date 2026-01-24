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
} from 'lucide-react';
import AdminPagination from '@/components/AdminPagination';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, AppRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import VideoBackground from '@/components/VideoBackground';
import GlassCard from '@/components/GlassCard';
import StatCard from '@/components/StatCard';
import Logo from '@/components/Logo';
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
  created_at: string;
}

interface UserPanel {
  id: string;
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

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [servers, setServers] = useState<PterodactylServer[]>([]);
  const [panels, setPanels] = useState<UserPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

  // Pagination & Search
  const ITEMS_PER_PAGE = 10;
  const [usersPage, setUsersPage] = useState(1);
  const [serversPage, setServersPage] = useState(1);
  const [panelsPage, setPanelsPage] = useState(1);
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

  // Clear all progress
  const [clearingProgress, setClearingProgress] = useState<{
    isClearing: boolean;
    total: number;
    current: number;
    deleted: number;
    failed: number;
  }>({ isClearing: false, total: 0, current: 0, deleted: 0, failed: 0 });

  // Server form state
  const [serverForm, setServerForm] = useState({
    name: '',
    domain: '',
    plta_key: '',
    pltc_key: '',
    server_type: 'public',
    location_id: 1,
    egg_id: 15,
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

  // Reset page when search changes
  useEffect(() => {
    setUsersPage(1);
    setServersPage(1);
    setPanelsPage(1);
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
    await Promise.all([fetchUsers(), fetchServers(), fetchPanels()]);
    setLoading(false);
  };

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
      // Delete from profiles (will cascade to user_roles due to FK)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Pengguna berhasil dihapus.',
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
      const { error } = await supabase
        .from('user_panels')
        .delete()
        .eq('id', panelId);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Panel berhasil dihapus.',
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
            const { error } = await supabase
              .from('profiles')
              .delete()
              .eq('user_id', user.user_id);
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
          total: nonAdminUsers.length,
          current: processedCount,
          deleted: deletedCount,
          failed: failedCount,
        });
      }

      // Reset progress
      setClearingProgress({ isClearing: false, total: 0, current: 0, deleted: 0, failed: 0 });

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
      setClearingProgress({ isClearing: false, total: 0, current: 0, deleted: 0, failed: 0 });
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
      <div className="min-h-screen flex items-center justify-center">
        <VideoBackground />
        <div className="glass-card rounded-2xl p-8">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground mt-4">Memuat data admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 px-4">
      <VideoBackground />

      <div className="w-full max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <GlassCard className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link to="/" className="p-2 hover:bg-secondary rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </Link>
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
            <Logo showText={false} />
          </div>
        </GlassCard>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Users} label="Total User" value={totalUsers} delay={0.1} />
          <StatCard icon={Server} label="Total Server" value={totalServers} delay={0.15} />
          <StatCard icon={HardDrive} label="Total Panel" value={totalPanels} delay={0.2} />
          <StatCard icon={Shield} label="Status" value="Aktif" status="online" delay={0.25} />
        </div>

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
            <TabsList className="grid w-full grid-cols-3 bg-secondary/50 mb-6">
              <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Users className="w-4 h-4 mr-2" />
                Pengguna ({filteredUsers.length})
              </TabsTrigger>
              <TabsTrigger value="servers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Server className="w-4 h-4 mr-2" />
                Server ({filteredServers.length})
              </TabsTrigger>
              <TabsTrigger value="panels" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <HardDrive className="w-4 h-4 mr-2" />
                Panel ({filteredPanels.length})
              </TabsTrigger>
            </TabsList>

            {/* Users Tab */}
            <TabsContent value="users">
              {/* Progress Dialog */}
              <Dialog open={clearingProgress.isClearing}>
                <DialogContent className="glass-card sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-destructive animate-pulse" />
                      Menghapus Akun...
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
                  <AlertDialogContent className="glass-card">
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
                      <TableHead>Panel</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                                <DialogContent className="glass-card">
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
                                <AlertDialogContent className="glass-card">
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
              <div className="flex justify-end mb-4">
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
                  <DialogContent className="glass-card max-w-lg">
                    <DialogHeader>
                      <DialogTitle>
                        {editingServer ? 'Edit Server' : 'Tambah Server Baru'}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
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
                      <div className="grid grid-cols-3 gap-4">
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
                          <Label>Egg ID</Label>
                          <Input
                            type="number"
                            value={serverForm.egg_id}
                            onChange={(e) => setServerForm({ ...serverForm, egg_id: parseInt(e.target.value) })}
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
                      <TableHead>Nama</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>PLTA Key</TableHead>
                      <TableHead>PLTC Key</TableHead>
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
                      paginatedServers.map((server) => (
                        <TableRow key={server.id} className="border-border/30">
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
                                <AlertDialogContent className="glass-card">
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
                      ))
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
                          <TableCell>{panel.profiles?.email || '-'}</TableCell>
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
                              <AlertDialogContent className="glass-card">
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
          </Tabs>
        </GlassCard>

        {/* Footer */}
        <p className="text-center text-muted-foreground text-xs mt-8">
          Admin Panel &copy; 2024 Jhonaley Panel
        </p>
      </div>
    </div>
  );
};

export default Admin;
