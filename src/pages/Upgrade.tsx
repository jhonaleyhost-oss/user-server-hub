import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  ExternalLink,
  Check,
  ShieldCheck,
  Zap,
  Code,
  Crown,
  Infinity as InfinityIcon,
  QrCode,
  Loader2,
  Copy,
  X,
  CheckCircle2,
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

interface PopupButton {
  label: string;
  url: string;
}

interface PopupData {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  buttons: PopupButton[];
}

type PlanKey = '1bln' | '2bln' | 'perm';

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
  { key: '1bln', label: '1 Bulan', duration: '30 hari', durationDays: 30, amount: 5000 },
  { key: '2bln', label: '2 Bulan', duration: '60 hari', durationDays: 60, amount: 10000, badge: 'Hemat' },
  { key: 'perm', label: 'Permanen', duration: 'Selamanya', durationDays: null, amount: 15000, badge: 'Spesial', highlight: true },
];

const PAKASIR_SLUG = 'jhonaley-store';
const PAKASIR_BASE = 'https://app.pakasir.com';

const renderContent = (text: string) => {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (trimmed === '') return <div key={i} className="h-2" />;

    const parts = line.split(/\*\*(.*?)\*\*/g);
    const isTreeItem = /^[├└│]/.test(trimmed);
    const isNumbered = /^[1-5]️⃣/.test(trimmed);

    return (
      <p
        key={i}
        className={`leading-relaxed ${
          isTreeItem
            ? 'text-foreground/90 pl-1 font-mono text-[13px]'
            : isNumbered
            ? 'text-foreground/90 pl-1'
            : 'text-foreground/80'
        }`}
      >
        {parts.map((part, j) =>
          j % 2 === 1 ? (
            <span key={j} className="font-bold text-primary">
              {part}
            </span>
          ) : (
            <span key={j}>{part}</span>
          )
        )}
      </p>
    );
  });
};

const Upgrade = () => {
  const { user } = useAuth();
  const { role, refetch } = useUserRole();
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<PlanKey>('perm');
  const [orderId, setOrderId] = useState('');
  const [qrisPayload, setQrisPayload] = useState('');
  const [showQris, setShowQris] = useState(false);
  const [qrisLoading, setQrisLoading] = useState(false);
  const [pollingOid, setPollingOid] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [fullName, setFullName] = useState('Pengguna');

  const plan = useMemo(() => PLANS.find((p) => p.key === selected)!, [selected]);
  const isAlreadyReseller = role === 'reseller' || role === 'admin';

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

  useEffect(() => {
    const fetchPopup = async () => {
      const { data } = await supabase
        .from('popup_settings')
        .select('id, title, content, image_url, buttons')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (data) {
        const buttons = Array.isArray(data.buttons)
          ? (data.buttons as unknown as PopupButton[])
          : [];
        setPopup({ ...data, buttons });
      }
      setLoading(false);
    };
    fetchPopup();
  }, []);

  // Poll Pakasir until paid
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
          toast.success('Pembayaran berhasil! Role Reseller aktif 🎉');
          setPollingOid(null);
          setPaid(true);
          await refetch();
          clearInterval(interval);
        }
      } catch {
        // ignore
      }
    }, 5000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [pollingOid, plan.amount, refetch]);

  const generateRef = () => {
    const stamp = Date.now().toString(36).toUpperCase();
    const u = user?.id?.slice(0, 6).toUpperCase() ?? 'GUEST';
    return `UPG-${plan.key.toUpperCase()}-${u}-${stamp}`;
  };

  const handleGenerate = async () => {
    if (!user) {
      toast.error('Silakan login dulu');
      return;
    }
    if (isAlreadyReseller) {
      toast.info('Kamu sudah Reseller / Admin');
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
    } catch (e: any) {
      toast.error('Gagal generate QRIS: ' + (e?.message || String(e)));
    } finally {
      setQrisLoading(false);
    }
  };

  const pakasirUrl = `${PAKASIR_BASE}/pay/${PAKASIR_SLUG}/${plan.amount}?qris_only=1&order_id=${encodeURIComponent(
    orderId || 'PREVIEW',
  )}`;

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(pakasirUrl);
    toast.success('Link pembayaran disalin');
  };

  return (
    <PageTransition>
      <AppShell>
        <div className="min-h-screen py-8 px-4 bg-background">
          <div className="w-full max-w-2xl mx-auto relative z-10">
            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber via-primary to-accent mb-4 shadow-lg shadow-primary/30">
                <Crown className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
                Upgrade ke <span className="text-amber">Reseller</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Bayar via QRIS, role aktif otomatis dalam hitungan detik.
              </p>
            </motion.div>

            {/* Benefits Grid */}
            <GlassCard className="p-6 mb-6">
              <h3 className="font-bold text-foreground mb-4 text-center">Yang Kamu Dapatkan</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald shrink-0" /> Unlimited RAM & CPU
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald shrink-0" /> Buat Panel Tanpa Batas
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald shrink-0" /> Akses Semua Tipe Panel
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald shrink-0" /> Bisa Hapus Panel Sendiri
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald shrink-0" /> Anti-Intip & Aman 100%
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="w-4 h-4 text-emerald shrink-0" /> Server Private RAM 32 / Core 16
                </div>
                <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                  <Code className="w-4 h-4 text-emerald shrink-0" /> Support Python & Node.js
                </div>
              </div>
            </GlassCard>

            {/* Plan picker */}
            {!showQris && (
              <GlassCard className="p-5 sm:p-6 mb-6" delay={0.1}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider text-center mb-4">
                  Pilih Paket Reseller
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  {PLANS.map((p) => {
                    const active = p.key === selected;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setSelected(p.key)}
                        className={`relative text-left rounded-2xl p-4 border-2 transition-all ${
                          active
                            ? 'border-amber bg-gradient-to-br from-amber/15 via-primary/10 to-accent/10 shadow-lg shadow-amber/10 scale-[1.02]'
                            : 'border-border/60 bg-secondary/30 hover:border-primary/40'
                        }`}
                      >
                        {p.badge && (
                          <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber to-primary text-background">
                            {p.badge}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 mb-1">
                          {p.key === 'perm' ? (
                            <InfinityIcon className="w-4 h-4 text-amber" />
                          ) : (
                            <Crown className="w-4 h-4 text-primary" />
                          )}
                          <span className="text-sm font-bold text-foreground">{p.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-2">{p.duration}</p>
                        <p
                          className={`text-lg font-extrabold ${
                            active ? 'text-amber' : 'text-foreground'
                          }`}
                        >
                          Rp {p.amount.toLocaleString('id-ID')}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {isAlreadyReseller ? (
                  <div className="rounded-xl p-4 bg-emerald-500/10 border border-emerald-500/30 text-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                    <p className="text-sm font-semibold text-foreground">
                      Kamu sudah {role === 'admin' ? 'Admin' : 'Reseller'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Beli paket di atas untuk memperpanjang masa aktif.
                    </p>
                  </div>
                ) : null}

                <Button
                  onClick={handleGenerate}
                  disabled={qrisLoading}
                  className="w-full h-12 bg-gradient-to-r from-amber to-primary hover:opacity-90 text-background font-bold gap-2"
                >
                  {qrisLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <QrCode className="w-5 h-5" />
                  )}
                  {qrisLoading
                    ? 'Generating QRIS...'
                    : `Bayar Rp ${plan.amount.toLocaleString('id-ID')} via QRIS`}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  Role Reseller akan aktif otomatis setelah pembayaran terkonfirmasi.
                </p>
              </GlassCard>
            )}

            {/* QRIS canvas */}
            {showQris && qrisPayload && (
              <GlassCard className="p-3 sm:p-4 mb-6" animate={false}>
                <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-fuchsia-500/30 border border-white/10 p-3 space-y-3">
                  <div className="flex justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setShowQris(false);
                        setPollingOid(null);
                        setQrisPayload('');
                        setPaid(false);
                      }}
                      className="h-7 w-7 -mr-1 -mt-1 text-muted-foreground hover:text-destructive"
                      aria-label="Tutup"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="rounded-xl bg-background/70 backdrop-blur px-4 py-3 text-center border border-white/10">
                    <div className="text-base font-extrabold tracking-wide bg-gradient-to-r from-primary via-accent to-amber bg-clip-text text-transparent">
                      👑 UPGRADE RESELLER 👑
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Paket {plan.label} • {plan.duration}
                    </div>
                  </div>

                  <div className="rounded-xl px-4 py-3 text-center bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white shadow-lg">
                    <div className="text-[11px] font-semibold opacity-90">🧾 TOTAL PEMBAYARAN</div>
                    <div className="text-2xl font-extrabold">
                      Rp {plan.amount.toLocaleString('id-ID')}
                    </div>
                  </div>

                  <div className="relative mx-auto bg-white rounded-2xl p-5 w-full max-w-[280px]">
                    <span className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-fuchsia-400 rounded-tl-md" />
                    <span className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-fuchsia-400 rounded-tr-md" />
                    <span className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-fuchsia-400 rounded-bl-md" />
                    <span className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-fuchsia-400 rounded-br-md" />
                    <div className="relative flex items-center justify-center">
                      <QRCodeSVG
                        value={qrisPayload}
                        size={232}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#0a0a0a"
                        marginSize={0}
                      />
                      <div className="absolute w-12 h-12 rounded-full bg-white border-2 border-fuchsia-400 flex items-center justify-center shadow overflow-hidden">
                        <img src={qrisLogo} alt="Logo" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>

                  <div className="text-center text-[10px] font-semibold text-muted-foreground">
                    ▦ SUPPORTED PAYMENT METHODS ▦
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'DANA', color: 'from-sky-500 to-blue-600' },
                      { label: 'OVO', color: 'from-purple-500 to-indigo-600' },
                      { label: 'GOPAY', color: 'from-emerald-500 to-green-600' },
                      { label: 'BANK', color: 'from-rose-500 to-red-600' },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className={`text-center text-[11px] font-bold text-white py-1.5 rounded-lg bg-gradient-to-br ${m.color} shadow`}
                      >
                        {m.label}
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl bg-background/70 backdrop-blur px-4 py-2 text-center border border-white/10">
                    <div className="text-[11px] font-bold text-foreground">🔒 SECURE PAYMENT</div>
                    <div className="text-[10px] text-muted-foreground">
                      Protected by QRIS • Jhonaley Store
                    </div>
                  </div>

                  <div className="text-center text-[10px] text-muted-foreground tracking-widest font-mono">
                    REF: {orderId}
                  </div>

                  <Button onClick={handleCopyUrl} variant="outline" className="w-full h-10 gap-2">
                    <Copy className="w-4 h-4" />
                    Salin Link Pembayaran
                  </Button>

                  {paid ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 pt-1 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      Pembayaran berhasil! Role Reseller aktif.
                    </div>
                  ) : pollingOid ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Menunggu konfirmasi pembayaran...
                    </div>
                  ) : null}
                </div>
              </GlassCard>
            )}

            {/* Promo Content from DB */}
            {loading ? (
              <GlassCard className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-muted-foreground mt-4 text-sm">Memuat promo...</p>
              </GlassCard>
            ) : popup ? (
              <GlassCard className="overflow-hidden mb-6" animate={false}>
                <div className="relative p-5">
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(ellipse at top center, hsl(var(--primary)) 0%, transparent 70%)',
                    }}
                  />
                  <div className="relative flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/15 border border-primary/20">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground leading-tight">
                      {popup.title}
                    </h2>
                  </div>
                </div>

                {popup.image_url && (
                  <div className="px-5">
                    <img
                      src={popup.image_url}
                      alt="Promo"
                      className="w-full rounded-xl object-cover max-h-60 border border-border/30"
                    />
                  </div>
                )}

                <div className="px-5 py-4 text-sm space-y-0.5">
                  {renderContent(popup.content)}
                </div>

                {popup.buttons.length > 0 && (
                  <div className="px-5 pb-5 flex flex-wrap gap-2 justify-center">
                    {popup.buttons.map((btn, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                        onClick={() => window.open(btn.url, '_blank')}
                      >
                        {btn.label}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </Button>
                    ))}
                  </div>
                )}
              </GlassCard>
            ) : null}
          </div>
        </div>
      </AppShell>
    </PageTransition>
  );
};

export default Upgrade;