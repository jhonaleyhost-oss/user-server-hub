import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw, Trash2, UserX, AlertTriangle, Fingerprint, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface InactiveUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  ip_address: string | null;
  device_fingerprint: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  panel_count: number;
  days_inactive: number | null;
}

const AdminInactiveUsers = () => {
  const { toast } = useToast();
  const [days, setDays] = useState(30);
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [users, setUsers] = useState<InactiveUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanned, setScanned] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const scan = async () => {
    setScanning(true);
    setUsers([]);
    setSelected(new Set());
    try {
      const { data, error } = await supabase.functions.invoke('list-inactive-users', {
        body: { days },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Gagal memindai');
      setUsers(data.users || []);
      setScanned(true);
      toast({ title: 'Pindai selesai', description: `${data.total} akun tidak aktif ≥ ${days} hari` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Gagal', description: e.message });
    } finally {
      setScanning(false);
    }
  };

  const allSelected = users.length > 0 && users.every(u => selected.has(u.user_id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(users.map(u => u.user_id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    const ids = Array.from(selected);
    setProgress({ done: 0, total: ids.length });
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const { data, error } = await supabase.functions.invoke('delete-user', {
          body: { user_id: id },
        });
        if (error || (data && data.error)) throw new Error(error?.message || data?.error);
        success++;
      } catch {
        failed++;
      }
      setProgress(p => ({ done: p.done + 1, total: p.total }));
    }
    setDeleting(false);
    setUsers(prev => prev.filter(u => !selected.has(u.user_id)));
    setSelected(new Set());
    toast({
      title: 'Selesai',
      description: `${success} akun dihapus${failed ? `, ${failed} gagal` : ''} • IP/Fingerprint diblokir otomatis`,
    });
  };

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' }) : '-';

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Tidak aktif ≥</label>
          <Input
            type="number"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 30))}
            className="input-glass w-24 h-10"
          />
          <span className="text-xs text-muted-foreground">hari</span>
        </div>
        <Button onClick={scan} disabled={scanning} className="btn-primary gap-2">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {scanning ? 'Memindai...' : 'Pindai Akun'}
        </Button>
      </div>

      {/* Info */}
      <div className="flex items-start gap-2 p-3 rounded-lg border border-amber/40 bg-amber/10 text-xs">
        <AlertTriangle className="w-4 h-4 text-amber shrink-0 mt-0.5" />
        <p className="text-amber">
          Reseller, ADP Server, dan Admin <b>dikecualikan</b> otomatis. Menghapus akun akan menghapus profil, panel,
          role, akun auth, sekaligus <b>memblokir IP & fingerprint</b> agar tidak bisa daftar ulang.
        </p>
      </div>

      {/* Summary + bulk action */}
      {scanned && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">
              <b className="text-foreground">{users.length}</b> akun tidak aktif
            </span>
            {users.length > 0 && (
              <span className="text-muted-foreground">
                • <b className="text-foreground">{selected.size}</b> dipilih
              </span>
            )}
          </div>
          {users.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={toggleAll} className="text-xs">
                {allSelected ? 'Batal Pilih Semua' : 'Pilih Semua'}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={selected.size === 0 || deleting} className="gap-2">
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Hapus {selected.size}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border border-border rounded-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus {selected.size} akun tidak aktif?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Semua data akun (profil, panel, role, auth) akan dihapus permanen dan
                      IP + fingerprint akan diblokir agar tidak bisa registrasi ulang.
                      Aksi ini tidak dapat dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteSelected} className="bg-destructive hover:bg-destructive/90">
                      Hapus & Blokir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      )}

      {/* Delete progress */}
      {deleting && progress.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-destructive font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Menghapus akun {progress.done}/{progress.total}...
            </span>
            <span className="font-mono text-muted-foreground">
              {Math.round((progress.done / progress.total) * 100)}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-destructive/70 to-destructive"
              animate={{ width: `${(progress.done / progress.total) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}

      {/* List */}
      {!scanned && !scanning && (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <UserX className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Klik "Pindai Akun" untuk memulai</p>
        </div>
      )}

      {scanned && users.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <UserX className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
          <p className="text-sm text-muted-foreground">Tidak ada akun tidak aktif ≥ {days} hari 🎉</p>
        </div>
      )}

      {users.length > 0 && (
        <div className="space-y-2">
          {users.map((u) => {
            const checked = selected.has(u.user_id);
            const name = u.full_name?.trim() || u.email?.split('@')[0] || 'User';
            return (
              <div
                key={u.user_id}
                onClick={() => toggleOne(u.user_id)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  checked
                    ? 'border-destructive/50 bg-destructive/10'
                    : 'border-border bg-secondary/20 hover:border-primary/40'
                }`}
              >
                <Checkbox checked={checked} onCheckedChange={() => toggleOne(u.user_id)} />
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white shrink-0">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase">
                      {u.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {u.days_inactive}h tidak aktif
                    </span>
                    <span>Login: {fmtDate(u.last_sign_in_at)}</span>
                    <span>{u.panel_count} panel</span>
                    {u.ip_address && (
                      <span className="flex items-center gap-1 font-mono">
                        <Fingerprint className="w-3 h-3" />
                        {u.ip_address}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminInactiveUsers;