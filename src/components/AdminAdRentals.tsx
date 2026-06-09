import { useEffect, useState } from 'react';
import { Loader2, Trash2, Pause, Play, ExternalLink, Megaphone, Infinity as InfinityIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Row {
  id: string;
  user_id: string;
  title: string;
  content: string;
  status: string;
  is_admin_slot: boolean;
  starts_at: string | null;
  expires_at: string | null;
  amount: number | null;
  order_id: string | null;
  created_at: string;
}

interface Profile { user_id: string; full_name: string | null; email: string }

const AdminAdRentals = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ad_rentals')
      .select('*')
      .order('created_at', { ascending: false });
    setRows((data as any[]) || []);
    if (data && data.length > 0) {
      const uids = Array.from(new Set((data as any[]).map((r) => r.user_id)));
      const { data: p } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', uids);
      const map: Record<string, Profile> = {};
      for (const pr of (p as Profile[]) || []) map[pr.user_id] = pr;
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const toggle = async (r: Row) => {
    const ns = r.status === 'active' ? 'disabled' : 'active';
    const { error } = await supabase.from('ad_rentals').update({ status: ns }).eq('id', r.id);
    if (error) return toast.error(error.message);
    toast.success('Status diubah');
    fetchAll();
  };

  const del = async (r: Row) => {
    if (!confirm(`Hapus iklan "${r.title}"?`)) return;
    const { error } = await supabase.from('ad_rentals').delete().eq('id', r.id);
    if (error) return toast.error(error.message);
    toast.success('Dihapus');
    fetchAll();
  };

  if (loading) return <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Belum ada iklan disewa.</div>;
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const p = profiles[r.user_id];
        return (
          <div key={r.id} className="p-4 rounded-lg bg-secondary/30 border border-border/30 space-y-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Megaphone className="w-4 h-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm text-foreground truncate">{r.title}</span>
                  <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${
                    r.status === 'active' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                    r.status === 'pending' ? 'bg-amber/15 text-amber border-amber/30' :
                    'bg-muted text-muted-foreground border-border'
                  }`}>{r.status}</span>
                  {r.is_admin_slot && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border bg-amber/15 text-amber border-amber/30 flex items-center gap-1">
                      <InfinityIcon className="w-2.5 h-2.5" /> Admin
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {p?.full_name || p?.email || r.user_id.slice(0, 8)} • {r.amount ? `Rp ${r.amount.toLocaleString('id-ID')}` : 'gratis'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {r.starts_at ? `Mulai: ${new Date(r.starts_at).toLocaleString('id-ID')}` : 'Belum dimulai'}
                  {r.expires_at && ` • Berakhir: ${new Date(r.expires_at).toLocaleString('id-ID')}`}
                  {r.order_id && ` • ${r.order_id}`}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => toggle(r)} className="gap-1">
                  {r.status === 'active' ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </Button>
                <Button size="sm" variant="outline" onClick={() => del(r)} className="text-destructive border-destructive/30">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            {r.content && <p className="text-xs text-foreground/70 line-clamp-2 whitespace-pre-wrap">{r.content}</p>}
          </div>
        );
      })}
    </div>
  );
};

export default AdminAdRentals;