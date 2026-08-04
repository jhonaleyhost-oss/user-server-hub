import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import GlassCard from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Loader2, CheckCircle2 } from 'lucide-react';

const KEY = 'austin_api_version';
type Version = 'v1' | 'v2';

const AdminPaymentPage = () => {
  const [version, setVersion] = useState<Version>('v2');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', KEY)
        .maybeSingle();
      if (data?.value === 'v1' || data?.value === 'v2') setVersion(data.value);
      setLoading(false);
    })();
  }, []);

  const save = async (v: Version) => {
    setSaving(true);
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: KEY, value: v, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (error) {
      toast.error('Gagal menyimpan: ' + error.message);
      return;
    }
    setVersion(v);
    toast.success(`Payment gateway sekarang memakai API ${v.toUpperCase()}`);
  };

  return (
    <AdminLayout title="Payment Gateway" description="Atur versi API Austin Pay yang dipakai sistem">
      <GlassCard className="p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Versi API Austin Pay</p>
            <p className="text-xs text-muted-foreground">
              Berlaku untuk pembuatan QRIS, cek status, dan pembatalan transaksi.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat pengaturan…
          </div>
        ) : (
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Pilih versi</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['v1', 'v2'] as Version[]).map((v) => {
                const active = version === v;
                return (
                  <button
                    key={v}
                    type="button"
                    disabled={saving}
                    onClick={() => save(v)}
                    className={`relative rounded-xl border p-4 text-left transition-all min-h-[88px] ${
                      active
                        ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]'
                        : 'border-border hover:border-primary/50 hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">API {v.toUpperCase()}</span>
                      {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {v === 'v2' ? 'Endpoint terbaru (default)' : 'Endpoint lama (fallback)'}
                    </p>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Perubahan aktif maksimal ~30 detik. Cek status transaksi tetap otomatis mencoba versi
              satunya bila versi terpilih gagal.
            </p>
          </div>
        )}
      </GlassCard>
    </AdminLayout>
  );
};

export default AdminPaymentPage;