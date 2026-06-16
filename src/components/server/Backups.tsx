import { useEffect, useState, useCallback } from 'react';
import { usePteroProxy } from '@/hooks/usePteroProxy';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Download, RotateCcw, RefreshCw, Archive, Lock, Unlock } from 'lucide-react';

interface Backup {
  uuid: string;
  name: string;
  bytes: number;
  is_locked: boolean;
  is_successful: boolean;
  created_at: string;
  completed_at?: string;
}

function fmtBytes(b: number) {
  if (!b) return '-'; const u = ['B','KB','MB','GB']; let i = 0; let n = b;
  while (n >= 1024 && i < u.length-1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

export default function Backups({ panelId }: { panelId: string }) {
  const { call } = usePteroProxy(panelId);
  const { toast } = useToast();
  const [list, setList] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await call<any>('backups');
    setLoading(false);
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal load', description: String(r.data || r.error) }); return; }
    setList((r.data?.data || []).map((d: any) => d.attributes as Backup));
  }, [call, toast]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const r = await call('backups', { method: 'POST', body: { name: `backup-${new Date().toISOString().slice(0,16).replace('T','-').replace(':','')}` } });
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal', description: String(r.data || r.error) }); return; }
    toast({ title: 'Backup dimulai' });
    load();
  };
  const del = async (uuid: string) => {
    if (!confirm('Hapus backup ini?')) return;
    const r = await call(`backups/${uuid}`, { method: 'DELETE' });
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal', description: String(r.data || r.error) }); return; }
    load();
  };
  const lock = async (b: Backup) => {
    const r = await call(`backups/${b.uuid}/lock`, { method: 'POST' });
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal', description: String(r.data || r.error) }); return; }
    load();
  };
  const download = async (uuid: string) => {
    const r = await call<any>(`backups/${uuid}/download`);
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal', description: String(r.data || r.error) }); return; }
    const url = r.data?.attributes?.url;
    if (url) window.open(url, '_blank');
  };
  const restore = async (uuid: string) => {
    if (!confirm('Restore backup ini? Server akan di-stop & file akan ditimpa.')) return;
    const r = await call(`backups/${uuid}/restore`, { method: 'POST', body: { truncate: true } });
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal', description: String(r.data || r.error) }); return; }
    toast({ title: 'Restore dimulai' });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
        <Button size="sm" onClick={create}><Plus className="w-4 h-4 mr-1" /> Buat Backup</Button>
      </div>
      <div className="space-y-2">
        {list.map((b) => (
          <div key={b.uuid} className="glass-card rounded-xl p-3 border border-border/40 flex items-center gap-3">
            <Archive className={`w-4 h-4 ${b.is_successful ? 'text-emerald' : 'text-amber-400'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate flex items-center gap-2">{b.name} {b.is_locked && <Lock className="w-3 h-3 text-amber-400" />}</div>
              <div className="text-[11px] text-muted-foreground">{new Date(b.created_at).toLocaleString('id-ID')} · {fmtBytes(b.bytes)}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => download(b.uuid)} disabled={!b.is_successful}><Download className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="outline" onClick={() => restore(b.uuid)} disabled={!b.is_successful} title="Restore"><RotateCcw className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="outline" onClick={() => lock(b)}>{b.is_locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}</Button>
            <Button size="sm" variant="outline" onClick={() => del(b.uuid)} disabled={b.is_locked} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
        {list.length === 0 && !loading && <div className="text-sm text-muted-foreground text-center py-6">Belum ada backup</div>}
      </div>
    </div>
  );
}