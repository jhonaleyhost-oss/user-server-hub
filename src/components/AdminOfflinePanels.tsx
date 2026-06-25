import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, Loader2, RefreshCw, Trash2, ServerCrash, CheckCircle2, AlertTriangle, Code2, Ghost, PauseCircle, CloudOff, Power } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import ProcessLogDialog from '@/components/ProcessLogDialog';

interface ServerOption { id: string; name: string; domain: string; }
interface OfflinePanel {
  id: string; username: string; email: string;
  owner_email: string | null; owner_name: string | null;
  ptero_server_id: number | null;
  status: 'orphan' | 'suspended' | 'power_off' | 'unreachable' | 'online' | 'unknown';
  panel_type: string | null; ram: number; cpu: number; disk: number; created_at: string;
}

type FilterType = 'all' | 'orphan' | 'power_off' | 'suspended' | 'unreachable';

const AdminOfflinePanels = () => {
  const { toast } = useToast();
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [panels, setPanels] = useState<OfflinePanel[]>([]);
  const [scanned, setScanned] = useState(false);
  const [serverAlive, setServerAlive] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>('all');
  const [logs, setLogs] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [logSuccess, setLogSuccess] = useState(true);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStage, setScanStage] = useState('');
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [deleteStage, setDeleteStage] = useState('');

  // Animated staged progress while scan request is in flight (edge function is atomic)
  useEffect(() => {
    if (!scanning) { setScanProgress(0); setScanStage(''); return; }
    const stages = [
      { p: 10,  s: 'Menghubungi server Pterodactyl...' },
      { p: 30,  s: 'Mengambil daftar server (paginated)...' },
      { p: 55,  s: 'Memuat data pemilik panel...' },
      { p: 75,  s: 'Mengklasifikasi status panel...' },
      { p: 90,  s: 'Memeriksa power state tiap panel...' },
      { p: 95,  s: 'Menyelesaikan...' },
    ];
    let i = 0;
    setScanProgress(stages[0].p);
    setScanStage(stages[0].s);
    const id = setInterval(() => {
      i = Math.min(i + 1, stages.length - 1);
      setScanProgress(stages[i].p);
      setScanStage(stages[i].s);
    }, 1800);
    return () => clearInterval(id);
  }, [scanning]);

  // Animated staged progress while delete request is in flight
  useEffect(() => {
    if (!deleting) { setDeleteProgress(0); setDeleteStage(''); return; }
    const total = selected.size || 1;
    const stages = [
      { p: 8,  s: 'Memverifikasi izin admin...' },
      { p: 25, s: `Mengantri ${total} panel untuk dihapus...` },
      { p: 50, s: 'Menghapus dari Pterodactyl...' },
      { p: 75, s: 'Membersihkan database lokal...' },
      { p: 90, s: 'Mencatat aktivitas & notifikasi...' },
      { p: 95, s: 'Menyelesaikan...' },
    ];
    let i = 0;
    setDeleteProgress(stages[0].p);
    setDeleteStage(stages[0].s);
    const id = setInterval(() => {
      i = Math.min(i + 1, stages.length - 1);
      setDeleteProgress(stages[i].p);
      setDeleteStage(stages[i].s);
    }, 1200);
    return () => clearInterval(id);
  }, [deleting, selected.size]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('pterodactyl_servers')
        .select('id, name, domain')
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      setServers(data || []);
      if (data && data.length > 0 && !selectedServer) setSelectedServer(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scan = async () => {
    if (!selectedServer) return;
    setScanning(true); setPanels([]); setSelected(new Set()); setScanned(false);
    try {
      const { data, error } = await supabase.functions.invoke('scan-offline-panels', {
        body: { serverId: selectedServer },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Gagal scan');
      setPanels(data.panels || []);
      setServerAlive(!!data.serverAlive);
      setScanned(true);
      setScanProgress(100);
      setScanStage('Selesai');
      // Auto-select all panels that are NOT online (orphan + suspended + unreachable + unknown)
      const offlineIds = (data.panels || [])
        .filter((p: OfflinePanel) => p.status !== 'online')
        .map((p: OfflinePanel) => p.id);
      setSelected(new Set(offlineIds));
      toast({
        title: 'Scan selesai',
        description: `${data.orphanCount ?? 0} orphan • ${data.powerOffCount ?? 0} power off • ${data.suspendedCount ?? 0} suspended • ${data.unreachableCount ?? 0} unreachable • ${data.onlineCount ?? 0} online`,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Gagal scan', description: e.message });
    } finally {
      setScanning(false);
    }
  };

  const orphanPanels = panels.filter(p => p.status === 'orphan');
  const powerOffPanels = panels.filter(p => p.status === 'power_off');
  const suspendedPanels = panels.filter(p => p.status === 'suspended');
  const unreachablePanels = panels.filter(p => p.status === 'unreachable');
  const allOfflinePanels = panels.filter(p => p.status !== 'online');

  const visiblePanels =
    filter === 'orphan' ? orphanPanels
    : filter === 'power_off' ? powerOffPanels
    : filter === 'suspended' ? suspendedPanels
    : filter === 'unreachable' ? unreachablePanels
    : allOfflinePanels;

  const allSelected = visiblePanels.length > 0 && visiblePanels.every(p => selected.has(p.id));

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      visiblePanels.forEach(p => next.delete(p.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      visiblePanels.forEach(p => next.add(p.id));
      setSelected(next);
    }
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-offline-panels', {
        body: { panelIds: Array.from(selected), serverId: selectedServer },
      });
      if (error) throw error;
      setDeleteProgress(100);
      setDeleteStage('Selesai');
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
      setLogSuccess(!!data?.success);
      setLogOpen(true);
      if (!data?.success) throw new Error(data?.error || 'Gagal hapus');
      toast({ title: 'Berhasil', description: data.message });
      // Re-scan
      await scan();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Gagal', description: e.message });
    } finally {
      setDeleting(false);
    }
  };

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });

  const statusBadge = (s: OfflinePanel['status']) => {
    if (s === 'orphan') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-semibold bg-rose-500/10 border-rose-500/30 text-rose-400">
        <Ghost className="w-3 h-3" />Orphan 404
      </span>
    );
    if (s === 'power_off') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-semibold bg-red-500/10 border-red-500/30 text-red-400">
        <Power className="w-3 h-3" />Power Off
      </span>
    );
    if (s === 'suspended') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-semibold bg-amber/10 border-amber/40 text-amber">
        <PauseCircle className="w-3 h-3" />Suspended
      </span>
    );
    if (s === 'unreachable') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-semibold bg-orange-500/10 border-orange-500/30 text-orange-400">
        <CloudOff className="w-3 h-3" />Unreachable
      </span>
    );
    if (s === 'unknown') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-semibold bg-muted/30 border-border text-muted-foreground">
        <AlertTriangle className="w-3 h-3" />Unknown
      </span>
    );
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex-1 min-w-0">
          <Select value={selectedServer} onValueChange={setSelectedServer}>
            <SelectTrigger className="input-glass">
              <SelectValue placeholder="Pilih server..." />
            </SelectTrigger>
            <SelectContent>
              {servers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={scan} disabled={!selectedServer || scanning} className="btn-primary gap-2">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {scanning ? 'Memindai...' : 'Pindai Panel'}
        </Button>
      </div>

      {/* Scan progress */}
      {scanning && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-primary font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {scanStage || 'Memulai pindai...'}
            </span>
            <span className="font-mono text-muted-foreground">{scanProgress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary/70 to-primary"
              initial={{ width: 0 }}
              animate={{ width: `${scanProgress}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}

      {/* Status summary */}
      {scanned && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <div className="rounded-xl p-3 border border-border bg-secondary/30">
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
            <p className="text-lg font-bold">{panels.length}</p>
          </div>
          <div className="rounded-xl p-3 border border-orange-500/30 bg-orange-500/10">
            <p className="text-[10px] text-orange-300 uppercase flex items-center gap-1"><WifiOff className="w-3 h-3" />Offline</p>
            <p className="text-lg font-bold text-orange-400">{allOfflinePanels.length}</p>
          </div>
          <div className="rounded-xl p-3 border border-rose-500/30 bg-rose-500/10">
            <p className="text-[10px] text-rose-300 uppercase flex items-center gap-1"><Ghost className="w-3 h-3" />Orphan (404)</p>
            <p className="text-lg font-bold text-rose-400">{orphanPanels.length}</p>
          </div>
          <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10">
            <p className="text-[10px] text-red-300 uppercase flex items-center gap-1"><Power className="w-3 h-3" />Power Off</p>
            <p className="text-lg font-bold text-red-400">{powerOffPanels.length}</p>
          </div>
          <div className="rounded-xl p-3 border border-amber/40 bg-amber/10">
            <p className="text-[10px] text-amber uppercase flex items-center gap-1"><PauseCircle className="w-3 h-3" />Suspended</p>
            <p className="text-lg font-bold text-amber">{suspendedPanels.length}</p>
          </div>
          <div className="rounded-xl p-3 border border-emerald-500/30 bg-emerald-500/10">
            <p className="text-[10px] text-emerald-300 uppercase flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Online</p>
            <p className="text-lg font-bold text-emerald-400">{panels.filter(p => p.status === 'online').length}</p>
          </div>
        </motion.div>
      )}

      {scanned && serverAlive === false && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber/40 bg-amber/10 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber shrink-0 mt-0.5" />
          <p className="text-amber">
            Server Pterodactyl <b>tidak merespon</b> — semua panel di server ini ditandai <b>Unreachable</b>.
            Hapus panel hanya akan membersihkan database lokal.
          </p>
        </div>
      )}

      {/* Filter chips */}
      {scanned && allOfflinePanels.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {([
            { key: 'all', label: `Semua (${allOfflinePanels.length})`, color: 'bg-primary text-primary-foreground' },
            { key: 'orphan', label: `Orphan 404 (${orphanPanels.length})`, color: 'bg-rose-500 text-white' },
            { key: 'power_off', label: `Power Off (${powerOffPanels.length})`, color: 'bg-red-500 text-white' },
            { key: 'suspended', label: `Suspended (${suspendedPanels.length})`, color: 'bg-amber text-black' },
            { key: 'unreachable', label: `Unreachable (${unreachablePanels.length})`, color: 'bg-orange-500 text-white' },
          ] as { key: FilterType; label: string; color: string }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                filter === f.key
                  ? `${f.color} border-transparent shadow`
                  : 'bg-secondary/40 text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Bulk action */}
      {scanned && visiblePanels.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-muted-foreground">
            <b className="text-foreground">{selected.size}</b> dipilih
            {filter !== 'all' && <span> dari {visiblePanels.length} ditampilkan</span>}
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={selected.size === 0 || deleting} className="gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Hapus {selected.size} Panel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border border-border rounded-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus {selected.size} panel?</AlertDialogTitle>
                <AlertDialogDescription>
                  Panel akan dihapus dari database. Aksi ini tidak dapat dibatalkan dan akan tercatat di Aktivitas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={deleteSelected} className="bg-destructive hover:bg-destructive/90">
                  Hapus Semua
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Delete progress */}
      {deleting && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-destructive font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {deleteStage || 'Memulai penghapusan...'}
            </span>
            <span className="font-mono text-muted-foreground">{deleteProgress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary/60 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-destructive/70 to-destructive"
              initial={{ width: 0 }}
              animate={{ width: `${deleteProgress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}

      {/* Empty states */}
      {!scanned && (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <ServerCrash className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Pilih server lalu klik "Pindai Panel" untuk mendeteksi panel offline.</p>
        </div>
      )}

      {scanned && allOfflinePanels.length === 0 && (
        <div className="text-center py-10 border border-dashed border-emerald-500/30 rounded-xl bg-emerald-500/5">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-emerald-300">Tidak ada panel offline. Semua bersih ✨</p>
        </div>
      )}

      {/* Table */}
      {scanned && visiblePanels.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Spec</TableHead>
                <TableHead>Dibuat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiblePanels.map(p => (
                <TableRow key={p.id} className="border-border/50">
                  <TableCell>
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
                  </TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
                  <TableCell className="font-mono text-xs">{p.username}</TableCell>
                  <TableCell className="text-xs">
                    <div className="font-medium">{p.owner_name || '—'}</div>
                    <div className="text-muted-foreground">{p.owner_email || p.email}</div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-semibold ${
                      p.panel_type === 'python'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    }`}>
                      <Code2 className="w-3 h-3" />
                      {p.panel_type === 'python' ? 'Python' : 'NodeJS'}
                    </span>
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    R:{p.ram || '∞'} C:{p.cpu || '∞'} D:{p.disk || '∞'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDate(p.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProcessLogDialog
        open={logOpen}
        onOpenChange={setLogOpen}
        title="Log Hapus Panel Offline"
        description="Detail proses cleanup panel offline."
        logs={logs}
        success={logSuccess}
      />
    </div>
  );
};

export default AdminOfflinePanels;