import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw, Trash2, Ghost, CheckCircle2, CloudOff, AlertTriangle, Crown } from 'lucide-react';
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
interface OrphanPanel {
  id: string; username: string; email: string;
  owner_email: string | null; owner_name: string | null;
  ptero_user_id: number | null;
  status: 'orphan' | 'unreachable' | 'online';
  created_at: string;
}

const AdminOrphanAdminPanels = () => {
  const { toast } = useToast();
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [panels, setPanels] = useState<OrphanPanel[]>([]);
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
      if (data && data.length && !selectedServer) setSelectedServer(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scan = async () => {
    if (!selectedServer) return;
    setScanning(true); setPanels([]); setSelected(new Set()); setScanned(false);
    try {
      const { data, error } = await supabase.functions.invoke('scan-orphan-admin-panels', {
        body: { serverId: selectedServer },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Gagal scan');
      setPanels(data.panels || []);
      setServerAlive(!!data.serverAlive);
      setScanned(true);
      const orphanIds = (data.panels || []).filter((p: OrphanPanel) => p.status === 'orphan').map((p: OrphanPanel) => p.id);
      setSelected(new Set(orphanIds));
      toast({
        title: 'Scan selesai',
        description: `${data.orphanCount ?? 0} orphan • ${data.unreachableCount ?? 0} unreachable • ${data.onlineCount ?? 0} online`,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Gagal scan', description: e.message });
    } finally { setScanning(false); }
  };

  const orphanPanels = panels.filter(p => p.status === 'orphan');
  const unreachablePanels = panels.filter(p => p.status === 'unreachable');
  const onlinePanels = panels.filter(p => p.status === 'online');

  const allSelected = orphanPanels.length > 0 && orphanPanels.every(p => selected.has(p.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) orphanPanels.forEach(p => next.delete(p.id));
    else orphanPanels.forEach(p => next.add(p.id));
    setSelected(next);
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
      const { data, error } = await supabase.functions.invoke('delete-orphan-admin-panels', {
        body: { panelIds: Array.from(selected) },
      });
      if (error) throw error;
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
      setLogSuccess(!!data?.success);
      setLogOpen(true);
      if (!data?.success) throw new Error(data?.error || 'Gagal hapus');
      toast({ title: 'Berhasil', description: data.message });
      await scan();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Gagal', description: e.message });
    } finally { setDeleting(false); }
  };

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });

  const statusBadge = (s: OrphanPanel['status']) => {
    if (s === 'orphan') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-semibold bg-rose-500/10 border-rose-500/30 text-rose-400">
        <Ghost className="w-3 h-3" />Orphan
      </span>
    );
    if (s === 'unreachable') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-semibold bg-orange-500/10 border-orange-500/30 text-orange-400">
        <CloudOff className="w-3 h-3" />Unreachable
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-semibold bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
        <CheckCircle2 className="w-3 h-3" />Online
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex-1 min-w-0">
          <Select value={selectedServer} onValueChange={setSelectedServer}>
            <SelectTrigger className="input-glass"><SelectValue placeholder="Pilih server..." /></SelectTrigger>
            <SelectContent>
              {servers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={scan} disabled={!selectedServer || scanning} className="btn-primary gap-2">
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {scanning ? 'Memindai...' : 'Pindai Admin Panel'}
        </Button>
      </div>

      {scanned && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl p-3 border border-border bg-secondary/30">
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
            <p className="text-lg font-bold">{panels.length}</p>
          </div>
          <div className="rounded-xl p-3 border border-rose-500/30 bg-rose-500/10">
            <p className="text-[10px] text-rose-300 uppercase flex items-center gap-1"><Ghost className="w-3 h-3" />Orphan</p>
            <p className="text-lg font-bold text-rose-400">{orphanPanels.length}</p>
          </div>
          <div className="rounded-xl p-3 border border-orange-500/30 bg-orange-500/10">
            <p className="text-[10px] text-orange-300 uppercase flex items-center gap-1"><CloudOff className="w-3 h-3" />Unreachable</p>
            <p className="text-lg font-bold text-orange-400">{unreachablePanels.length}</p>
          </div>
          <div className="rounded-xl p-3 border border-emerald-500/30 bg-emerald-500/10">
            <p className="text-[10px] text-emerald-300 uppercase flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Online</p>
            <p className="text-lg font-bold text-emerald-400">{onlinePanels.length}</p>
          </div>
        </motion.div>
      )}

      {scanned && serverAlive === false && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber/40 bg-amber/10 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber shrink-0 mt-0.5" />
          <p className="text-amber">
            Server Pterodactyl <b>tidak merespon</b>. Tidak bisa mengklasifikasi orphan — coba lagi saat server online.
          </p>
        </div>
      )}

      {scanned && orphanPanels.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-muted-foreground">
            <b className="text-foreground">{selected.size}</b> dipilih dari {orphanPanels.length} orphan
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={selected.size === 0 || deleting} className="gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Hapus {selected.size} Admin Panel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border border-border rounded-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus {selected.size} admin panel orphan?</AlertDialogTitle>
                <AlertDialogDescription>
                  Baris admin_panels akan dihapus dari database. Slot pembuatan admin panel di server ini akan kembali. Aksi tidak dapat dibatalkan.
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

      {!scanned && (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <Crown className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Pilih server dan klik <b>Pindai Admin Panel</b> untuk mendeteksi orphan.</p>
        </div>
      )}

      {scanned && orphanPanels.length === 0 && (
        <div className="text-center py-8 border border-dashed border-border rounded-xl">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
          <p className="text-sm text-muted-foreground">Tidak ada admin panel orphan di server ini 🎉</p>
        </div>
      )}

      {scanned && orphanPanels.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Ptero User ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dibuat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orphanPanels.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.username}</TableCell>
                  <TableCell className="text-xs">
                    <div>{p.owner_name || '—'}</div>
                    <div className="text-muted-foreground">{p.owner_email || '—'}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.ptero_user_id ?? '—'}</TableCell>
                  <TableCell>{statusBadge(p.status)}</TableCell>
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
        title="Log Hapus Orphan Admin Panel"
        logs={logs}
        success={logSuccess}
      />
    </div>
  );
};

export default AdminOrphanAdminPanels;