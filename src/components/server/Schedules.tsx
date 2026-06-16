import { useEffect, useState, useCallback } from 'react';
import { usePteroProxy } from '@/hooks/usePteroProxy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Play, RefreshCw, Pause, Clock } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

interface Schedule {
  id: number;
  name: string;
  cron: { minute: string; hour: string; day_of_week: string; day_of_month: string; month: string };
  is_active: boolean;
  is_processing: boolean;
  last_run_at?: string;
  next_run_at?: string;
}

export default function Schedules({ panelId }: { panelId: string }) {
  const { call } = usePteroProxy(panelId);
  const { toast } = useToast();
  const [list, setList] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', minute: '*/5', hour: '*', day_of_week: '*', day_of_month: '*', month: '*', is_active: true });

  const load = useCallback(async () => {
    setLoading(true);
    const r = await call<any>('schedules');
    setLoading(false);
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal load', description: String(r.data || r.error) }); return; }
    setList((r.data?.data || []).map((d: any) => d.attributes as Schedule));
  }, [call, toast]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const r = await call('schedules', { method: 'POST', body: form });
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal', description: String(r.data || r.error) }); return; }
    setOpen(false); load();
  };

  const del = async (id: number) => {
    if (!confirm('Hapus schedule?')) return;
    const r = await call(`schedules/${id}`, { method: 'DELETE' });
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal', description: String(r.data || r.error) }); return; }
    load();
  };

  const trigger = async (id: number) => {
    const r = await call(`schedules/${id}/execute`, { method: 'POST' });
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal', description: String(r.data || r.error) }); return; }
    toast({ title: 'Schedule dijalankan' });
  };

  const toggle = async (s: Schedule) => {
    const r = await call(`schedules/${s.id}`, { method: 'POST', body: { name: s.name, ...s.cron, is_active: !s.is_active } });
    if (!r.success) { toast({ variant: 'destructive', title: 'Gagal', description: String(r.data || r.error) }); return; }
    load();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Schedule Baru</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Schedule Baru</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-5 gap-2">
                {(['minute', 'hour', 'day_of_month', 'month', 'day_of_week'] as const).map((k) => (
                  <div key={k}>
                    <Label className="text-[10px]">{k}</Label>
                    <Input value={(form as any)[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="font-mono text-xs" />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: c }))} /> <span className="text-sm">Aktif</span></div>
            </div>
            <DialogFooter><Button onClick={create}>Buat</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {list.map((s) => (
          <div key={s.id} className="glass-card rounded-xl p-3 border border-border/40 flex items-center gap-3">
            <Clock className={`w-4 h-4 ${s.is_active ? 'text-emerald' : 'text-muted-foreground'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{s.name}</div>
              <div className="font-mono text-[11px] text-muted-foreground truncate">
                {`${s.cron.minute} ${s.cron.hour} ${s.cron.day_of_month} ${s.cron.month} ${s.cron.day_of_week}`}
              </div>
              <div className="text-[10px] text-muted-foreground">Next: {s.next_run_at ? new Date(s.next_run_at).toLocaleString('id-ID') : '-'}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => trigger(s.id)} title="Run now"><Play className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="outline" onClick={() => toggle(s)}>{s.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}</Button>
            <Button size="sm" variant="outline" onClick={() => del(s.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
        {list.length === 0 && !loading && <div className="text-sm text-muted-foreground text-center py-6">Belum ada schedule</div>}
      </div>
    </div>
  );
}