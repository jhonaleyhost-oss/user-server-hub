import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
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
  CalendarClock,
  RefreshCw,
  Download,
  Server,
  KeyRound,
  Layers,
  Users,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import GlassCard from '@/components/GlassCard';
import AppShell from '@/components/AppShell';
import { PageTransition } from '@/components/PageTransition';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import qrisLogo from '@/assets/qris-logo.png';
import VerifiedBadge from '@/components/VerifiedBadge';
import PromoInput, { AppliedPromo } from '@/components/PromoInput';

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

type PlanKey = '1bln' | '2bln' | 'perm' | 'adp_1bln' | 'adp_2bln' | 'adp_perm';
type Tier = 'reseller' | 'adp';

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

const ADP_PLANS: Plan[] = [
  { key: 'adp_1bln', label: '1 Bulan', duration: '30 hari', durationDays: 30, amount: 10000 },
  { key: 'adp_2bln', label: '2 Bulan', duration: '60 hari', durationDays: 60, amount: 20000, badge: 'Hemat' },
  { key: 'adp_perm', label: 'Permanen', duration: 'Selamanya', durationDays: null, amount: 35000, badge: 'Terbaik', highlight: true },
];

const PAKASIR_SLUG = 'jhonaley-store';
const PAKASIR_BASE = 'https://app.pakasir.com';

const QRIS_STORAGE_KEY = (uid: string) => `upgrade_qris_${uid}`;

interface PendingOrder {
  order_id: string;
  plan: PlanKey;
  amount: number;
  created_at: string;
}

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
  const { role, isAdpServer, refetch } = useUserRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTier: Tier = searchParams.get('tier') === 'adp' ? 'adp' : 'reseller';
  const [tier, setTier] = useState<Tier>(initialTier);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<PlanKey>('perm');
  const [orderId, setOrderId] = useState('');
  const [qrisPayload, setQrisPayload] = useState('');
  const [qrisAmount, setQrisAmount] = useState<number>(0);
  const [showQris, setShowQris] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [qrisLoading, setQrisLoading] = useState(false);
  const [pollingOid, setPollingOid] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [fullName, setFullName] = useState('Pengguna');
  const [manualChecking, setManualChecking] = useState<string | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [status, setStatus] = useState<{
    is_reseller: boolean;
    permanent: boolean;
    expires_at: string | null;
    days_left: number | null;
  } | null>(null);
  const [adpStatus, setAdpStatus] = useState<{
    permanent: boolean;
    expires_at: string | null;
  } | null>(null);

  const isAdpTier = tier === 'adp';
  const activePlans = isAdpTier ? ADP_PLANS : PLANS;
  const plan = useMemo(
    () => activePlans.find((p) => p.key === selected) ?? activePlans[0],
    [selected, activePlans],
  );
  const payAmount = appliedPromo?.final_amount ?? plan.amount;
  const isReseller = role === 'reseller' || role === 'admin';
  const isAlreadyReseller = isAdpTier ? isAdpServer : isReseller;
  const isPermanent = isAdpTier
    ? (!!adpStatus?.permanent || role === 'admin')
    : (!!status?.permanent || role === 'admin');

  // Reset selected plan & promo when switching tier
  useEffect(() => {
    setSelected(isAdpTier ? 'adp_perm' : 'perm');
    setAppliedPromo(null);
    const current = searchParams.get('tier');
    if (isAdpTier && current !== 'adp') {
      searchParams.set('tier', 'adp');
      setSearchParams(searchParams, { replace: true });
    } else if (!isAdpTier && current) {
      searchParams.delete('tier');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  const loadStatus = async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_my_reseller_status');
    if (data && data.length > 0) setStatus(data[0] as any);
    const { data: prof } = await supabase
      .from('profiles')
      .select('adp_server_expires_at, adp_server_permanent')
      .eq('user_id', user.id)
      .maybeSingle();
    if (prof) {
      setAdpStatus({
        permanent: !!prof.adp_server_permanent,
        expires_at: (prof.adp_server_expires_at as string | null) ?? null,
      });
    }
  };

  const loadPendingOrders = async () => {
    if (!user) return;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('reseller_orders')
      .select('order_id, plan, amount, created_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    setPendingOrders((data as any) || []);
  };

  const handleCancelOrder = async (oid: string) => {
    if (!user) return;
    if (!confirm('Batalkan pembayaran ini?')) return;
    setManualChecking(oid);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-qris', {
        body: { order_id: oid },
      });
      if (error || data?.error) {
        toast.error('Gagal batalkan: ' + (data?.error || error?.message));
        return;
      }
      toast.success('Pembayaran dibatalkan');
      // Jika order yang dibatalkan sedang ditampilkan QRIS-nya, tutup juga
      if (orderId === oid) {
        setShowQris(false);
        setQrisPayload('');
        setPollingOid(null);
        localStorage.removeItem(QRIS_STORAGE_KEY(user.id));
      }
      await loadPendingOrders();
    } finally {
      setManualChecking(null);
    }
  };

  const confirmCancelQris = async () => {
    if (!user || !orderId) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-qris', {
        body: { order_id: orderId },
      });
      if (error || data?.error) {
        toast.error('Gagal batalkan: ' + (data?.error || error?.message));
        return;
      }
      toast.success('Pembayaran dibatalkan');
      setShowQris(false);
      setQrisPayload('');
      setPollingOid(null);
      setPaid(false);
      try {
        localStorage.removeItem(QRIS_STORAGE_KEY(user.id));
      } catch {
        // ignore
      }
      await loadPendingOrders();
    } finally {
      setCancelling(false);
      setCancelOpen(false);
    }
  };

  const handlePayPending = async (o: PendingOrder) => {
    if (!user) return;
    setManualChecking(o.order_id);
    try {
      const { data, error } = await supabase.functions.invoke('create-qris', {
        body: { amount: o.amount, order_id: o.order_id },
      });
      if (error || !data?.qris) {
        toast.error('Gagal generate QRIS: ' + (error?.message || data?.error || 'unknown'));
        return;
      }
      const targetTier: Tier = String(o.plan).startsWith('adp_') ? 'adp' : 'reseller';
      setTier(targetTier);
      setSelected(o.plan);
      setOrderId(o.order_id);
      setQrisPayload(data.qris as string);
      setQrisAmount(Number(data.amount ?? o.amount));
      setShowQris(true);
      setPaid(false);
      setPollingOid(o.order_id);
      try {
        localStorage.setItem(
          QRIS_STORAGE_KEY(user.id),
          JSON.stringify({
            orderId: o.order_id,
            qrisPayload: data.qris,
            plan: o.plan,
            amount: Number(data.amount ?? o.amount),
            savedAt: Date.now(),
          }),
        );
      } catch {
        // ignore
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      toast.error('Gagal: ' + (e?.message || String(e)));
    } finally {
      setManualChecking(null);
    }
  };

  useEffect(() => {
    loadPendingOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, paid]);

  // Restore QRIS from localStorage on mount
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(QRIS_STORAGE_KEY(user.id));
      if (!raw) return;
      const saved = JSON.parse(raw);
      // expire after 30 min
      if (Date.now() - (saved.savedAt || 0) > 30 * 60 * 1000) {
        localStorage.removeItem(QRIS_STORAGE_KEY(user.id));
        return;
      }
      if (saved.orderId && saved.qrisPayload && saved.plan) {
        setSelected(saved.plan);
        setOrderId(saved.orderId);
        setQrisPayload(saved.qrisPayload);
        setQrisAmount(Number(saved.amount) || 0);
        setShowQris(true);
        setPollingOid(saved.orderId);
      }
    } catch {
      // ignore
    }
  }, [user]);

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
    const amt = payAmount;
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
          toast.success(
            isAdpTier
              ? 'Pembayaran berhasil! Admin Panel Server aktif 🎉'
              : 'Pembayaran berhasil! Role Reseller aktif 🎉',
          );
          setPollingOid(null);
          setPaid(true);
          if (appliedPromo && user) {
            await supabase.from('promo_redemptions').insert({
              promo_id: appliedPromo.promo_id,
              user_id: user.id,
              order_ref: pollingOid,
              scope: isAdpTier ? 'adp' : 'reseller',
              discount_applied: appliedPromo.discount,
            });
            setAppliedPromo(null);
          }
          await refetch();
          if (user) localStorage.removeItem(QRIS_STORAGE_KEY(user.id));
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
  }, [pollingOid, payAmount, refetch, user, appliedPromo]);

  const generateRef = () => {
    const stamp = Date.now().toString(36).toUpperCase();
    const u = user?.id?.slice(0, 6).toUpperCase() ?? 'GUEST';
    const prefix = isAdpTier ? 'ADP' : 'UPG';
    return `${prefix}-${plan.key.toUpperCase()}-${u}-${stamp}`;
  };

  const handleGenerate = async () => {
    if (!user) {
      toast.error('Silakan login dulu');
      return;
    }
    if (isPermanent) {
      toast.info('Kamu sudah Reseller Permanen, tidak perlu perpanjang.');
      return;
    }
    if (plan.key === 'perm' && isAlreadyReseller) {
      // allowed: upgrade dari berlangganan ke permanen
    }
    const oid = generateRef();
    setOrderId(oid);
    setQrisPayload('');
    setQrisLoading(true);
    setPaid(false);
    try {
      const { data, error } = await supabase.functions.invoke('create-qris', {
        body: { amount: payAmount, order_id: oid },
      });
      if (error || !data?.qris) {
        toast.error('Gagal generate QRIS: ' + (error?.message || data?.error || 'unknown'));
        return;
      }
      setQrisPayload(data.qris as string);
      setQrisAmount(Number(data.amount ?? payAmount));
      const { error: insErr } = await supabase.from('reseller_orders').insert({
        user_id: user.id,
        username: fullName,
        plan: plan.key,
        duration_days: plan.durationDays,
        amount: payAmount,
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
          QRIS_STORAGE_KEY(user.id),
          JSON.stringify({
            orderId: oid,
            qrisPayload: data.qris,
            plan: plan.key,
            amount: Number(data.amount ?? payAmount),
            savedAt: Date.now(),
          }),
        );
      } catch {
        // ignore
      }
      await loadPendingOrders();
    } catch (e: any) {
      toast.error('Gagal generate QRIS: ' + (e?.message || String(e)));
    } finally {
      setQrisLoading(false);
    }
  };

  const handleManualCheck = async (oid: string, amt: number) => {
    setManualChecking(oid);
    try {
      const { data, error } = await supabase.functions.invoke('check-upgrade', {
        body: { order_id: oid, amount: amt },
      });
      if (error) {
        toast.error('Gagal cek: ' + error.message);
        return;
      }
      if (data?.completed) {
        toast.success(
          isAdpTier
            ? 'Pembayaran terkonfirmasi! Admin Panel Server aktif 🎉'
            : 'Pembayaran terkonfirmasi! Role Reseller aktif 🎉',
        );
        setPaid(true);
        setPollingOid(null);
        await refetch();
        await loadStatus();
        await loadPendingOrders();
        if (user) localStorage.removeItem(QRIS_STORAGE_KEY(user.id));
      } else {
        toast.info(`Status: ${data?.status || 'pending'} — belum terbayar.`);
      }
    } catch (e: any) {
      toast.error('Gagal cek: ' + (e?.message || String(e)));
    } finally {
      setManualChecking(null);
    }
  };

  const pakasirUrl = `${PAKASIR_BASE}/pay/${PAKASIR_SLUG}/${plan.amount}?qris_only=1&order_id=${encodeURIComponent(
    orderId || 'PREVIEW',
  )}`;

  const handleCopyUrl = async () => {
    if (qrisPayload) {
      await navigator.clipboard.writeText(qrisPayload);
      toast.success('Kode QRIS disalin');
      return;
    }
    await navigator.clipboard.writeText(pakasirUrl);
    toast.success('Link pembayaran disalin');
  };

  const handleDownloadQris = async () => {
    try {
      const svg = document.getElementById('qris-svg') as unknown as SVGSVGElement | null;
      if (!svg) return;
      const xml = new XMLSerializer().serializeToString(svg);
      const svg64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const total = qrisAmount || payAmount;
      const title = isAdpTier ? 'ADMIN PANEL SERVER' : 'UPGRADE RESELLER';
      img.onload = () => {
        const W = 720;
        const PAD = 40;
        const qrSize = 460;
        const qrBox = qrSize + 56;
        const H = 1000;

        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d')!;

        // Clean light card
        ctx.fillStyle = '#f4f5f7';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, 24, 24, W - 48, H - 48, 28);
        ctx.fill();

        ctx.textAlign = 'center';
        let y = 96;

        // Brand
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 30px sans-serif';
        ctx.fillText('Jhonaley Store', W / 2, y);
        y += 30;
        ctx.fillStyle = '#64748b';
        ctx.font = '15px sans-serif';
        ctx.fillText(`${title} • ${plan.label} (${plan.duration})`, W / 2, y);
        y += 40;

        // Divider
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD + 8, y);
        ctx.lineTo(W - PAD - 8, y);
        ctx.stroke();
        y += 46;

        // Total
        ctx.fillStyle = '#64748b';
        ctx.font = '600 14px sans-serif';
        ctx.fillText('TOTAL PEMBAYARAN', W / 2, y);
        y += 46;
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 44px sans-serif';
        ctx.fillText(`Rp ${total.toLocaleString('id-ID')}`, W / 2, y);
        y += 22;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px sans-serif';
        ctx.fillText('Bayar sesuai nominal persis (termasuk kode unik)', W / 2, y);
        y += 34;

        // QR frame
        const qx = (W - qrBox) / 2;
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        roundRect(ctx, qx, y, qrBox, qrBox, 24);
        ctx.stroke();
        ctx.drawImage(img, qx + 28, y + 28, qrSize, qrSize);
        y += qrBox + 44;

        // Footer
        ctx.fillStyle = '#0f172a';
        ctx.font = '600 15px sans-serif';
        ctx.fillText('Scan dengan aplikasi e-wallet / mobile banking (QRIS)', W / 2, y);
        y += 26;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '13px "Courier New", monospace';
        ctx.fillText(`REF: ${orderId || '-'}`, W / 2, y);

        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `QRIS-${orderId || 'upgrade'}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success('QRIS berhasil diunduh');
      };
      img.onerror = () => toast.error('Gagal generate gambar QRIS');
      img.src = svg64;
    } catch (e: any) {
      toast.error('Gagal download QRIS: ' + (e?.message || String(e)));
    }
  };

  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  return (
    <PageTransition>
      <AppShell>
        <div className="min-h-screen py-8 px-4 bg-background">
          <div className="w-full max-w-2xl mx-auto relative z-10">
            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <div
                className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-2xl ${
                  isAdpTier
                    ? 'bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-purple-700 shadow-fuchsia-500/50 ring-2 ring-fuchsia-400/60'
                    : 'bg-gradient-to-br from-amber via-primary to-accent shadow-primary/30'
                }`}
              >
                {isAdpTier ? (
                  <Crown className="w-8 h-8 text-white drop-shadow-lg" strokeWidth={2.5} />
                ) : (
                  <ShieldCheck className="w-8 h-8 text-white" strokeWidth={2.5} />
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
                {isAdpTier ? (
                  <>
                    Upgrade ke{' '}
                    <span className="text-fuchsia-500 dark:text-fuchsia-400 drop-shadow-[0_0_12px_rgba(217,70,239,0.5)]">
                      Admin Panel
                    </span>
                  </>
                ) : (
                  <>
                    Upgrade ke <span className="text-amber">Reseller</span>
                  </>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isAdpTier
                  ? 'Kuasai server-mu — jadi root-admin Pterodactyl, kelola user & panel sendiri.'
                  : 'Bayar via QRIS, role aktif otomatis dalam hitungan detik.'}
              </p>
            </motion.div>

            {/* Tier Switcher */}
            {!showQris && (
              <div className="grid grid-cols-2 gap-2 mb-6 p-1 rounded-2xl bg-secondary/40 border border-border/60">
                <button
                  type="button"
                  onClick={() => setTier('reseller')}
                  className={`relative rounded-xl px-3 py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    !isAdpTier
                      ? 'bg-gradient-to-r from-amber to-primary text-background shadow'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Reseller
                </button>
                <button
                  type="button"
                  onClick={() => setTier('adp')}
                  className={`relative rounded-xl px-3 py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    isAdpTier
                      ? 'bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-purple-700 text-white shadow-lg shadow-fuchsia-500/40'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Crown className="w-4 h-4" />
                  Admin Panel
                  <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow">
                    NEW
                  </span>
                </button>
              </div>
            )}

            {/* Benefits Grid */}
            <GlassCard className={`p-6 mb-6 ${isAdpTier ? 'border-purple-500/30' : ''}`}>
              <h3 className="font-bold text-foreground mb-4 text-center flex items-center justify-center gap-2">
                <Sparkles className={`w-4 h-4 ${isAdpTier ? 'text-purple-400' : 'text-amber'}`} />
                {isAdpTier ? 'Benefit Admin Panel Server' : 'Benefit Reseller'}
              </h3>
              <p className="text-xs text-muted-foreground text-center mb-4">
                {isAdpTier
                  ? 'ADP Server adalah role tertinggi setelah Admin. Semua benefit Reseller sudah termasuk — kamu tidak perlu beli Reseller terpisah.'
                  : 'Reseller memberikan akses penuh ke semua fitur premium Jhonaley Store untuk menjalankan bot WhatsApp tanpa batas.'}
              </p>
              {isAdpTier ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      <b className="text-foreground">Termasuk semua fitur Reseller</b> — panel unlimited, server private, support prioritas
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Crown className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      Jadi <b className="text-foreground">root-admin Pterodactyl</b> dengan kontrol penuh atas panel
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <KeyRound className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      Dapatkan <b className="text-foreground">URL login, username, password, PLTA &amp; PLTC</b> sendiri
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Users className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      Buat dan kelola <b className="text-foreground">sub-user / klien</b> di bawah panel kamu
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Server className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      Buatkan <b className="text-foreground">server/panel</b> untuk setiap user yang kamu kelola
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Layers className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      Setiap sub-user dapat <b className="text-foreground">PLTA &amp; PLTC</b> masing-masing
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 text-fuchsia-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      Badge <b className="text-foreground">ungu eksklusif ADP Server</b> di samping nama profil
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      Bisa <b className="text-foreground">buka jualan Reseller & Panel</b> sendiri — kamu jadi owner panel pribadi
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      Batas: <b className="text-foreground">1 Admin Panel per server</b> (server publik &amp; private dihitung terpisah)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <InfinityIcon className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      <b className="text-foreground">Unlimited RAM &amp; CPU</b> — tidak ada batasan resource untuk panel kamu
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Layers className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      <b className="text-foreground">Buat Panel Tanpa Batas</b> — bikin banyak panel bot sesuai kebutuhan
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Code className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      Akses <b className="text-foreground">2 tipe panel: Node.js dan Python</b> dalam satu akun
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Server className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      <b className="text-foreground">Akses Server Private</b> — server semi-private dengan resource lebih stabil
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      <b className="text-foreground">Hapus &amp; kelola panel sendiri</b> — fleksibel tanpa harus hubungi admin
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      <b className="text-foreground">Server Semi Private 8 GB RAM / 4 Core</b> — performa lebih tinggi
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      <b className="text-foreground">Aman &amp; Anti-Intip</b> — isolasi panel dan proteksi standar industri
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <Crown className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      <b className="text-foreground">Badge Reseller eksklusif</b> — tanda verifikasi di profil kamu
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-snug">
                      <b className="text-foreground">Tidak ada biaya tambahan</b> — sekali bayar, pakai sesuai masa aktif yang dipilih
                    </span>
                  </div>
                </div>
              )}
            </GlassCard>

            {/* Plan picker */}
            {!showQris && (
              <GlassCard className="p-5 sm:p-6 mb-6" delay={0.1}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider text-center mb-4">
                  {isAlreadyReseller && !isPermanent
                    ? isAdpTier
                      ? 'Perpanjang Masa Aktif Admin Panel'
                      : 'Perpanjang Masa Aktif Reseller'
                    : isAdpTier
                    ? 'Pilih Paket Admin Panel'
                    : 'Pilih Paket Reseller'}
                </p>

                {/* Status */}
                {isAlreadyReseller && !isAdpTier && (
                  <div className="mb-4 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-primary/5 to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 shrink-0">
                        {isPermanent ? (
                          <InfinityIcon className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <CalendarClock className="w-5 h-5 text-emerald-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">
                          Status: {role === 'admin' ? 'Admin' : 'Reseller Aktif'}
                        </p>
                        {isPermanent ? (
                          <p className="text-xs text-emerald-400 mt-0.5">
                            Berlaku selamanya — tidak perlu perpanjang.
                          </p>
                        ) : status?.expires_at ? (
                          <>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Berakhir:{' '}
                              <span className="text-foreground font-semibold">
                                {new Date(status.expires_at).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </p>
                            {typeof status.days_left === 'number' && (
                              <p
                                className={`text-[11px] mt-1 font-semibold ${
                                  status.days_left <= 2
                                    ? 'text-rose-400'
                                    : status.days_left <= 7
                                    ? 'text-amber'
                                    : 'text-emerald-400'
                                }`}
                              >
                                Sisa {status.days_left} hari
                                {status.days_left <= 2 ? ' — segera perpanjang!' : ''}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Pilih paket di bawah untuk memperpanjang.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {isAdpTier && isAlreadyReseller && (
                  <div className="mb-4 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-fuchsia-500/5 to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/15 border border-purple-500/30 shrink-0">
                        {isPermanent ? (
                          <InfinityIcon className="w-5 h-5 text-purple-400" />
                        ) : (
                          <CalendarClock className="w-5 h-5 text-purple-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">Admin Panel Server Aktif</p>
                        {isPermanent ? (
                          <p className="text-xs text-purple-300 mt-0.5">Permanen — selamanya.</p>
                        ) : adpStatus?.expires_at ? (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Berakhir{' '}
                            <span className="text-foreground font-semibold">
                              {new Date(adpStatus.expires_at).toLocaleString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
                {!isAdpTier && (
                  <div className="mb-4 rounded-xl border border-amber/30 bg-amber/10 px-3 py-2.5 text-[11px] leading-relaxed text-foreground/90">
                    <span className="font-bold text-amber">NOTE:</span> Paket ini menggunakan{' '}
                    <span className="font-semibold">VPS DIGITALOCEAN</span>. Jika ingin yang{' '}
                    <span className="font-semibold">anti mokad</span>, silahkan klik{' '}
                    <a
                      href="https://t.me/upgradeuser_bot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                    >
                      Beli Panel Legal
                    </a>{' '}
                    untuk membeli panel yang dijamin anti mokad 100% dan aktif 30 hari full.
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                  {activePlans.map((p) => {
                    const active = p.key === selected;
                    const disabled = isPermanent;
                    const isPerm = p.key === 'perm' || p.key === 'adp_perm';
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => !disabled && setSelected(p.key)}
                        disabled={disabled}
                        className={`relative text-left rounded-2xl p-4 border-2 transition-all ${
                          disabled ? 'opacity-50 cursor-not-allowed' : ''
                        } ${
                          active
                            ? isAdpTier
                              ? 'border-purple-500 bg-gradient-to-br from-purple-500/15 via-fuchsia-500/10 to-purple-500/10 shadow-lg shadow-purple-500/20 scale-[1.02]'
                              : 'border-amber bg-gradient-to-br from-amber/15 via-primary/10 to-accent/10 shadow-lg shadow-amber/10 scale-[1.02]'
                            : isAdpTier
                            ? 'border-border/60 bg-secondary/30 hover:border-purple-500/40'
                            : 'border-border/60 bg-secondary/30 hover:border-primary/40'
                        }`}
                      >
                        {p.badge && (
                          <span
                            className={`absolute -top-2 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                              isAdpTier
                                ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white'
                                : 'bg-gradient-to-r from-amber to-primary text-background'
                            }`}
                          >
                            {p.badge}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 mb-1">
                          {isPerm ? (
                            <InfinityIcon className={`w-4 h-4 ${isAdpTier ? 'text-purple-400' : 'text-amber'}`} />
                          ) : isAdpTier ? (
                            <ShieldCheck className="w-4 h-4 text-purple-400" />
                          ) : (
                            <Crown className="w-4 h-4 text-primary" />
                          )}
                          <span className="text-sm font-bold text-foreground">{p.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-2">{p.duration}</p>
                        <p
                          className={`text-lg font-extrabold ${
                            active ? (isAdpTier ? 'text-fuchsia-300' : 'text-amber') : 'text-foreground'
                          }`}
                        >
                          Rp {p.amount.toLocaleString('id-ID')}
                        </p>
                        <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-1.5">
                          {isAdpTier ? (
                            <>
                              <VerifiedBadge role="adp_server" plan={p.key} size={14} />
                              <span className="text-[10px] text-muted-foreground leading-tight">
                                Unlock Badge{' '}
                                <span className="font-semibold text-foreground">
                                  {p.key === 'adp_1bln'
                                    ? 'Centang Cyan'
                                    : p.key === 'adp_2bln'
                                    ? 'Centang Pink'
                                    : 'Ungu Eksklusif'}
                                </span>
                              </span>
                            </>
                          ) : (
                            <>
                              <VerifiedBadge role="reseller" plan={p.key} size={14} />
                              <span className="text-[10px] text-muted-foreground leading-tight">
                                Unlock Badge Eksklusif{' '}
                                <span className="font-semibold text-foreground">
                                  {p.key === '1bln'
                                    ? 'Centang Biru'
                                    : p.key === '2bln'
                                    ? 'Centang Hijau'
                                    : 'Centang Merah'}
                                </span>
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Button
                  onClick={handleGenerate}
                  disabled={qrisLoading || isPermanent}
                  className={`w-full h-12 hover:opacity-90 font-bold gap-2 ${
                    isAdpTier
                      ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-700 text-white shadow-lg shadow-purple-500/30'
                      : 'bg-gradient-to-r from-amber to-primary text-background'
                  }`}
                >
                  {qrisLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isAlreadyReseller && !isPermanent ? (
                    <RefreshCw className="w-5 h-5" />
                  ) : (
                    <QrCode className="w-5 h-5" />
                  )}
                  {qrisLoading
                    ? 'Generating QRIS...'
                    : isPermanent
                    ? 'Sudah Permanen'
                    : isAlreadyReseller
                    ? `Perpanjang ${plan.label} • Rp ${payAmount.toLocaleString('id-ID')}`
                    : `Bayar Rp ${payAmount.toLocaleString('id-ID')} via QRIS`}
                </Button>
                <div className="mt-3">
                  <PromoInput scope={isAdpTier ? 'adp' : 'reseller'} amount={plan.amount} applied={appliedPromo} onApply={setAppliedPromo} />
                </div>
                {appliedPromo && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Harga normal:</span>
                    <span className="line-through text-muted-foreground">Rp {plan.amount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  {isAdpTier
                    ? isAlreadyReseller && !isPermanent
                      ? 'Masa aktif baru ditambahkan ke sisa hari Admin Panel Server kamu.'
                      : 'Admin Panel Server aktif otomatis setelah pembayaran terkonfirmasi. Kompatibel bersama role Reseller.'
                    : isAlreadyReseller && !isPermanent
                    ? 'Masa aktif baru ditambahkan ke sisa hari yang ada.'
                    : 'Role Reseller akan aktif otomatis setelah pembayaran terkonfirmasi.'}
                </p>
              </GlassCard>
            )}

            {/* QRIS canvas */}
            {showQris && qrisPayload && (
              <GlassCard className="p-3 sm:p-4 mb-6" animate={false}>
                <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4 space-y-3">
                  <div className="flex justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (paid) {
                          setShowQris(false);
                          setPollingOid(null);
                          setQrisPayload('');
                          setPaid(false);
                          return;
                        }
                        setCancelOpen(true);
                      }}
                      className="h-7 w-7 -mr-1 -mt-1 text-muted-foreground hover:text-destructive"
                      aria-label="Tutup"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="text-center">
                    <p className="text-sm font-bold text-foreground">
                      {isAdpTier ? 'Admin Panel Server' : 'Upgrade Reseller'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Paket {plan.label} • {plan.duration}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-secondary/30 px-4 py-3 text-center">
                    <div className="text-[10px] font-semibold tracking-wider text-muted-foreground">
                      TOTAL PEMBAYARAN
                    </div>
                    <div className="text-3xl font-extrabold text-foreground tabular-nums">
                      Rp {(qrisAmount || payAmount).toLocaleString('id-ID')}
                    </div>
                    {qrisAmount > payAmount && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Harga Rp {payAmount.toLocaleString('id-ID')} + kode unik Rp{' '}
                        {(qrisAmount - payAmount).toLocaleString('id-ID')}
                      </div>
                    )}
                    <div className="text-[10px] text-amber mt-1">
                      Bayar sesuai nominal persis agar terverifikasi otomatis
                    </div>
                  </div>

                  <div className="mx-auto bg-white rounded-2xl p-4 w-full max-w-[272px] border border-border/60">
                    <div className="relative flex items-center justify-center">
                      <QRCodeSVG
                        value={qrisPayload}
                        size={232}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#0a0a0a"
                        marginSize={0}
                        id="qris-svg"
                      />
                      <div className="absolute w-11 h-11 rounded-full bg-white border border-border flex items-center justify-center shadow overflow-hidden">
                        <img src={qrisLogo} alt="QRIS" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  </div>

                  <p className="text-center text-[11px] text-muted-foreground">
                    Scan lewat DANA, OVO, GoPay, ShopeePay, atau mobile banking apa pun.
                  </p>

                  <div className="text-center text-[10px] text-muted-foreground font-mono">
                    REF: {orderId}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={handleCopyUrl} variant="outline" className="h-10 gap-2">
                      <Copy className="w-4 h-4" />
                      Salin Link
                    </Button>
                    <Button onClick={handleDownloadQris} variant="outline" className="h-10 gap-2">
                      <Download className="w-4 h-4" />
                      Download QRIS
                    </Button>
                  </div>

                  {paid ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 pt-1 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      Pembayaran berhasil! {isAdpTier ? 'Admin Panel Server aktif.' : 'Role Reseller aktif.'}
                    </div>
                  ) : pollingOid ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Menunggu konfirmasi pembayaran...
                    </div>
                  ) : null}

                  {!paid && (
                    <Button
                      onClick={() => handleManualCheck(orderId, payAmount)}
                      disabled={manualChecking === orderId}
                      variant="outline"
                      className="w-full h-10 gap-2 border-emerald-500/40 hover:bg-emerald-500/10"
                    >
                      {manualChecking === orderId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Cek Status Pembayaran
                    </Button>
                  )}
                </div>
              </GlassCard>
            )}

            {/* Pending orders (manual recheck) */}
            {!showQris && pendingOrders.length > 0 && (
              <GlassCard className="p-5 mb-6" animate={false}>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarClock className="w-4 h-4 text-amber" />
                  <h3 className="text-sm font-bold text-foreground">Pembayaran Belum Selesai</h3>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Sudah bayar tapi role belum aktif? Klik <b>Cek Status</b> di bawah.
                </p>
                <div className="space-y-2">
                  {pendingOrders.map((o) => (
                    <div
                      key={o.order_id}
                      className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 space-y-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-foreground truncate">{o.order_id}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {o.plan.toUpperCase()} • Rp {o.amount.toLocaleString('id-ID')} •{' '}
                          {new Date(o.created_at).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={manualChecking === o.order_id || (orderId === o.order_id && showQris)}
                          onClick={() => handlePayPending(o)}
                          className="h-8 gap-1 border-amber/40 hover:bg-amber/10"
                        >
                          {manualChecking === o.order_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <QrCode className="w-3 h-3" />
                          )}
                          <span className="text-xs">Bayar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={manualChecking === o.order_id}
                          onClick={() => handleManualCheck(o.order_id, o.amount)}
                          className="h-8 gap-1 border-emerald-500/40 hover:bg-emerald-500/10"
                        >
                          {manualChecking === o.order_id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          <span className="text-xs">Cek</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={manualChecking === o.order_id}
                          onClick={() => handleCancelOrder(o.order_id)}
                          className="h-8 gap-1 border-destructive/40 hover:bg-destructive/10 text-destructive"
                        >
                          <X className="w-3 h-3" />
                          <span className="text-xs">Batal</span>
                        </Button>
                      </div>
                    </div>
                  ))}
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

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan pembayaran?</AlertDialogTitle>
            <AlertDialogDescription>
              QRIS ini akan dibatalkan dan tidak bisa dibayar lagi. Kamu tetap bisa membuat
              pembayaran baru kapan saja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Lanjut Bayar</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                confirmCancelQris();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? 'Membatalkan...' : 'Ya, Batalkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
};

export default Upgrade;