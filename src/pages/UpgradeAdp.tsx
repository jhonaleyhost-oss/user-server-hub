import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ShieldCheck,
  Crown,
  Infinity as InfinityIcon,
  QrCode,
  Loader2,
  Copy,
  X,
  CheckCircle2,
  CalendarClock,
  Server,
  KeyRound,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import GlassCard from '@/components/GlassCard';
import AppShell from '@/components/AppShell';
import { PageTransition } from '@/components/PageTransition';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import qrisLogo from '@/assets/qris-logo.png';

type PlanKey = 'adp_1bln' | 'adp_2bln' | 'adp_perm';

interface Plan {
  key: PlanKey;
  label: string;
  duration: string;
  durationDays: number | null;
  amount: number;
  badge?: string;
  highlight?: boolean;
}

const PLANS: Plan[] = [
  { key: 'adp_1bln', label: '1 Bulan', duration: '30 hari', durationDays: 30, amount: 10000 },
  { key: 'adp_2bln', label: '2 Bulan', duration: '60 hari', durationDays: 60, amount: 20000, badge: 'Hemat' },
  { key: 'adp_perm', label: 'Permanen', duration: 'Selamanya', durationDays: null, amount: 35000, badge: 'Terbaik', highlight: true },
];

const QRIS_KEY = (uid: string) => `upgrade_adp_qris_${uid}`;

interface AdpStatus {
  active: boolean;
  permanent: boolean;
  expires_at: string | null;
}

const UpgradeAdp = () => {
  const { user } = useAuth();
  const { role, isAdpServer, refetch } = useUserRole();
  const [selected, setSelected] = useState<PlanKey>('adp_perm');
  const [orderId, setOrderId] = useState('');
  const [qrisPayload, setQrisPayload] = useState('');
  const [showQris, setShowQris] = useState(false);
  const [qrisLoading, setQrisLoading] = useState(false);
  const [pollingOid, setPollingOid] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [fullName, setFullName] = useState('Pengguna');
  const [status, setStatus] = useState<AdpStatus | null>(null);

  const plan = useMemo(() => PLANS.find((p) => p.key === selected)!, [selected]);
  const isPermanent = !!status?.permanent || role === 'admin';

  const loadStatus = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('adp_server_expires_at, adp_server_permanent')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      const perm = !!data.adp_server_permanent;
      const exp = data.adp_server_expires_at as string | null;
      const active = perm || (!!exp && new Date(exp) > new Date());
      setStatus({ active, permanent: perm, expires_at: exp });
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, paid]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name?.trim() || user.email?.split('@')[0] || 'Pengguna');
      });
  }, [user]);

  // Restore QRIS from localStorage
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(QRIS_KEY(user.id));
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Date.now() - (s.savedAt || 0) > 30 * 60 * 1000) {
        localStorage.removeItem(QRIS_KEY(user.id));
        return;
      }
      if (s.orderId && s.qrisPayload && s.plan) {
        setSelected(s.plan);
        setOrderId(s.orderId);
        setQrisPayload(s.qrisPayload);
        setShowQris(true);
        setPollingOid(s.orderId);
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!pollingOid) return;
    const amt = plan.amount;
    let stopped = false;
    const startedAt = Date.now();
    const interval = setInterval(async () => {
      if (stopped) return;
      if (Date.now() - startedAt > 15 * 60 * 1000) {
        setPollingOid(null);
        clearInterval(interval);
        return;
      }
      try {
        const { data } = await supabase.functions.invoke('check-upgrade', {
          body: { order_id: pollingOid, amount: amt },
        });
        if (data?.completed) {
          toast.success('Pembayaran berhasil! Admin Panel Server aktif 🎉');
          setPollingOid(null);
          setPaid(true);
          await refetch();
          if (user) localStorage.removeItem(QRIS_KEY(user.id));
          clearInterval(interval);
        }
      } catch {}
    }, 5000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [pollingOid, plan.amount, refetch, user]);

  const generateRef = () => {
    const stamp = Date.now().toString(36).toUpperCase();
    const u = user?.id?.slice(0, 6).toUpperCase() ?? 'GUEST';
    return `ADP-${plan.key.toUpperCase()}-${u}-${stamp}`;
  };

  const handleGenerate = async () => {
    if (!user) {
      toast.error('Silakan login dulu');
      return;
    }
    if (isPermanent) {
      toast.info('Kamu sudah punya Admin Panel Server permanen.');
      return;
    }
    const oid = generateRef();
    setOrderId(oid);
    setQrisPayload('');
    setQrisLoading(true);
    setPaid(false);
    try {
      const { data, error } = await supabase.functions.invoke('create-qris', {
        body: { amount: plan.amount, order_id: oid },
      });
      if (error || !data?.qris) {
        toast.error('Gagal generate QRIS: ' + (error?.message || data?.error || 'unknown'));
        return;
      }
      setQrisPayload(data.qris as string);
      const { error: insErr } = await supabase.from('reseller_orders').insert({
        user_id: user.id,
        username: fullName,
        plan: plan.key,
        duration_days: plan.durationDays,
        amount: plan.amount,
        order_id: oid,
        status: 'pending',
      });
      if (insErr) {
        toast.error('Gagal simpan order: ' + insErr.message);
        return;
      }
      setShowQris(true);
      setPollingOid(oid);
      try {
        localStorage.setItem(
          QRIS_KEY(user.id),
          JSON.stringify({
            orderId: oid,
            qrisPayload: data.qris,
            plan: plan.key,
            amount: plan.amount,
            savedAt: Date.now(),
          }),
        );
      } catch {}
    } catch (e: any) {
      toast.error('Gagal generate QRIS: ' + (e?.message || String(e)));
    } finally {
      setQrisLoading(false);
    }
  };

  const cancelQris = () => {
    setShowQris(false);
    setQrisPayload('');
    setPollingOid(null);
    setOrderId('');
    if (user) localStorage.removeItem(QRIS_KEY(user.id));
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-3"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-purple-700 shadow-xl">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-r from-purple-400 via-fuchsia-400 to-purple-500 bg-clip-text text-transparent">
              Admin Panel Server
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
              Role super eksklusif — buat panel Pterodactyl <b>root-admin</b> dengan PLTA/PLTC di setiap server yang tersedia (1 admin panel per server).
            </p>
          </motion.div>

          {isAdpServer && status && (
            <GlassCard className="p-4 rounded-2xl border-purple-500/30">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Admin Panel Server Aktif</p>
                    <p className="text-xs text-muted-foreground">
                      {status.permanent
                        ? 'Permanen (selamanya)'
                        : status.expires_at
                        ? `Berakhir ${new Date(status.expires_at).toLocaleString('id-ID')}`
                        : '—'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.href = '/admin-panels')}
                  className="gap-2"
                >
                  <Server className="w-4 h-4" /> Kelola
                </Button>
              </div>
            </GlassCard>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PLANS.map((p) => {
              const active = selected === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setSelected(p.key)}
                  className={`relative text-left rounded-2xl p-4 border transition-all ${
                    active
                      ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20 scale-[1.02]'
                      : 'border-border/60 bg-secondary/40 hover:border-purple-500/50'
                  }`}
                >
                  {p.badge && (
                    <span className="absolute -top-2 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow">
                      {p.badge}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    {p.key === 'adp_perm' ? (
                      <InfinityIcon className="w-4 h-4 text-purple-400" />
                    ) : (
                      <CalendarClock className="w-4 h-4 text-purple-400" />
                    )}
                    <span className="text-sm font-bold text-foreground">{p.label}</span>
                  </div>
                  <div className="text-2xl font-black text-foreground">
                    Rp{p.amount.toLocaleString('id-ID')}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{p.duration}</div>
                </button>
              );
            })}
          </div>

          <GlassCard className="p-5 rounded-2xl space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" /> Fitur Admin Panel Server
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1.5 pl-1">
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" /> Buat 1 Admin Panel per server Pterodactyl (root_admin=1)</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" /> Dapat URL panel, username, password, <b>PLTA</b> & <b>PLTC</b></li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" /> Bisa buat user baru di panel Pterodactyl kamu (dengan PLTA/PLTC per user)</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" /> Bisa buat server/panel untuk user bikinan kamu</li>
                <li className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" /> Badge <b>ungu eksklusif</b> di samping nama kamu</li>
                <li className="flex gap-2"><KeyRound className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" /> Kompatibel dengan role Reseller — bisa dimiliki bersamaan</li>
              </ul>
            </div>

            {!showQris ? (
              <Button
                onClick={handleGenerate}
                disabled={qrisLoading || isPermanent}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-700 hover:opacity-90 text-white font-bold gap-2 shadow-lg shadow-purple-500/30"
              >
                {qrisLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Membuat QRIS...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4" /> Bayar Rp{plan.amount.toLocaleString('id-ID')} — {plan.label}
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white">
                  <img src={qrisLogo} alt="QRIS" className="h-8 object-contain" />
                  <QRCodeSVG value={qrisPayload} size={220} includeMargin />
                  <p className="text-xs text-slate-700 font-mono break-all text-center">{orderId}</p>
                  <p className="text-sm font-bold text-slate-900">
                    Rp{plan.amount.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menunggu pembayaran...
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(qrisPayload);
                      toast.success('QRIS payload disalin');
                    }}
                    className="flex-1 gap-2"
                  >
                    <Copy className="w-4 h-4" /> Salin
                  </Button>
                  <Button
                    variant="outline"
                    onClick={cancelQris}
                    className="flex-1 gap-2 text-destructive"
                  >
                    <X className="w-4 h-4" /> Batal
                  </Button>
                </div>
              </div>
            )}
          </GlassCard>

          <p className="text-center text-xs text-muted-foreground">
            Sudah reseller? Role ini <b>tidak menggantikan</b> reseller kamu — keduanya berjalan paralel. Setelah adp_server berakhir, kamu otomatis kembali ke role reseller (jika masih aktif).
          </p>
        </div>
      </PageTransition>
    </AppShell>
  );
};

export default UpgradeAdp;