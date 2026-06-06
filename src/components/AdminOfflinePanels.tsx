import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { WifiOff, Loader2, RefreshCw, Trash2, ServerCrash, CheckCircle2, AlertTriangle, Code2 } from 'lucide-react';
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
  ptero_server_id: number | null; status: 'offline' | 'online' | 'unknown';
  panel_type: string | null; ram: number; cpu: number; disk: number; created_at: string;
}

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
  const [logs, setLogs] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [logSuccess, setLogSuccess] = useState(true);

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
      // Auto-select all offline panels
      const offlineIds = (data.panels || []).filter((p: OfflinePanel) => p.status === 'offline').map((p: OfflinePanel) => p.id);
      setSelected(new Set(offlineIds));
      toast({
        title: 'Scan selesai',
        description: `${data.offlineCount} panel offline dari ${data.total} panel${!data.serverAlive ? ' (server tidak merespon)' : ''}.`,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Gagal scan', description: e.message });
    } finally {
      setScanning(false);
    }
  };

  const offlinePanels = panels.filter(p => p.status === 'offline');
  const allSelected = offlinePanels.length > 0 && offlinePanels.every(p => selected.has(p.id));

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(offlinePanels.map(p => p.id)));
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

      {/* Status summary */}
      {scanned && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-3 border border-border bg-secondary/30">
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
            <p className="text-lg font-bold">{panels.length}</p>
          </div>
          <div className="rounded-xl p-3 border border-red-500/30 bg-red-500/10">
            <p className="text-[10px] text-red-300 uppercase flex items-center gap-1"><WifiOff className="w-3 h-3" />Offline</p>
            <p className="text-lg font-bold text-red-400">{offlinePanels.length}</p>
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
            Server Pterodactyl <b>tidak merespon</b> — semua panel di server ini dianggap offline.
            Hapus panel hanya akan membersihkan database lokal.
          </p>
        </div>
      )}

      {/* Bulk action */}
      {scanned && offlinePanels.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-muted-foreground">
            <b className="text-foreground">{selected.size}</b> dari {offlinePanels.length} panel offline dipilih
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={selected.size === 0 || deleting} className="gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Hapus {selected.size} Panel Offline
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border border-border rounded-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus {selected.size} panel offline?</AlertDialogTitle>
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

      {/* Empty states */}
      {!scanned && (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <ServerCrash className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Pilih server lalu klik "Pindai Panel" untuk mendeteksi panel offline.</p>
        </div>
      )}

      {scanned && offlinePanels.length === 0 && (
        <div className="text-center py-10 border border-dashed border-emerald-500/30 rounded-xl bg-emerald-500/5">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-emerald-300">Tidak ada panel offline. Semua bersih ✨</p>
        </div>
      )}

      {/* Table */}
      {scanned && offlinePanels.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Spec</TableHead>
                <TableHead>Dibuat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offlinePanels.map(p => (
                <TableRow key={p.id} className="border-border/50">
                  <TableCell>
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
                  </TableCell>
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