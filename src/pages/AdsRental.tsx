import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Megaphone,
  Check,
  ShieldCheck,
  Sparkles,
  Clock,
  QrCode,
  Loader2,
  Copy,
  X,
  CheckCircle2,
  Infinity as InfinityIcon,
  AlertTriangle,
  Eye,
  FileText,
  Users as UsersIcon,
  Pause,
  Play,
  Trash2,
  Calendar,
  Crown,
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
import AdEditor, { AdRentalRow, AdButton } from '@/components/AdEditor';
import { useNavigate } from 'react-router-dom';
import PromoInput, { AppliedPromo } from '@/components/PromoInput';

const QRIS_KEY = (uid: string) => `ad_rental_qris_${uid}`;

interface AdPackage {
  key: '1d' | '7d' | '14d' | '30d';
  label: string;
  days: number;
  price: number;
  badge?: string;
  highlight?: boolean;
}

const PACKAGES: AdPackage[] = [
  { key: '1d',  label: '1 Hari',  days: 1,  price: 2000 },
  { key: '7d',  label: '7 Hari',  days: 7,  price: 10000, badge: 'Populer' },
  { key: '14d', label: '14 Hari', days: 14, price: 18000, badge: 'Hemat' },
  { key: '30d', label: '30 Hari', days: 30, price: 30000, badge: 'Best', highlight: true },
];

interface MyRental extends AdRentalRow {
  status: string;
  is_admin_slot: boolean;
  starts_at: string | null;
  expires_at: string | null;
  amount: number | null;
  order_id: string | null;
}

interface SlotInfo { total: number; used: number; available: number }

const daysLeft = (iso: string | null) => {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86400000);
};

const BENEFITS = [
  { icon: Crown, title: 'BONUS: Role Reseller Gratis', desc: 'Setiap pembelian iklan otomatis upgrade akun kamu jadi Reseller selama durasi paket (1/7/14/30 hari). Jika sudah reseller, masa aktif diperpanjang sesuai paket.' },
  { icon: Eye, title: 'Eksposur ke Semua User', desc: 'Iklan tampil sebagai popup di seluruh halaman website (Dashboard, Panel, Auth, dll) untuk semua pengguna yang login.' },
  { icon: Calendar, title: 'Durasi 30 Hari Penuh', desc: 'Sekali bayar, iklan aktif penuh selama 30 hari kalender. Tidak ada biaya tambahan.' },
  { icon: FileText, title: 'Konten Bisa Diedit', desc: 'Judul, gambar, deskripsi, dan tombol link bisa diubah kapan saja selama masa aktif iklan.' },
  { icon: UsersIcon, title: 'Nama Anda Tampil', desc: 'Nama pengiklan ditampilkan di popup sehingga audiens tahu siapa di balik iklan tersebut (membangun kredibilitas).' },
  { icon: ShieldCheck, title: 'Pembayaran Aman', desc: 'Pembayaran via QRIS terverifikasi otomatis. Aktivasi instan begitu pembayaran terkonfirmasi.' },
  { icon: Sparkles, title: 'Notifikasi ke User', desc: 'Saat Anda mengaktifkan iklan, sebuah notifikasi muncul di Dashboard semua user (efek viral).' },
];

const TOS = [
  'Konten iklan TIDAK boleh memuat hal-hal ilegal, melanggar hukum Indonesia, atau melanggar Hak Kekayaan Intelektual pihak ketiga.',
  'DILARANG mempromosikan: penipuan (scam), judi online, investasi bodong, MLM piramida, narkotika/obat terlarang, konten dewasa/pornografi, kekerasan, ujaran kebencian, SARA, atau hoaks.',
  'DILARANG menyesatkan pengguna dengan klaim palsu, harga tidak sesuai, atau testimoni fiktif.',
  'DILARANG meniru identitas brand resmi (termasuk Jhonaley Store, Pterodactyl, Supabase, dll) atau menyamar sebagai pihak resmi.',
  'DILARANG menyertakan link phishing, malware, virus, atau apapun yang membahayakan perangkat/akun pengguna.',
  'Pengiklan bertanggung jawab penuh atas isi iklan dan klaim yang dibuat. Sengketa dengan pembeli/konsumen adalah tanggung jawab pengiklan.',
  'Admin berhak menonaktifkan iklan tanpa pemberitahuan dan TANPA REFUND apabila ditemukan pelanggaran TOS ini.',
  'Slot iklan terbatas hanya 2 aktif secara global (di luar slot admin). Jika penuh, tunggu sampai ada iklan yang expired untuk membuka slot baru.',
  'Pembayaran yang sudah berhasil tidak dapat dikembalikan (non-refundable) kecuali terjadi kegagalan sistem dari pihak kami.',
  'Dengan menyewa slot iklan ini Anda setuju pada semua ketentuan di atas.',
];

const FREQ_NOTE = [
  'Iklan tampil sebagai popup di SEMUA halaman website.',
  'Setiap user yang refresh halaman akan kembali melihat popup (1x per page load).',
  'Untuk user dengan role Reseller/Admin tersedia tombol "Jangan tampilkan lagi" — namun popup tetap akan muncul kembali setiap hari pukul 07:00 WIB.',
  'Hanya 1 iklan acak yang ditampilkan per page load (jika ada beberapa iklan aktif sekaligus, sistem akan merotasinya secara adil).',
  'Di pojok kanan atas popup terdapat label "Iklan" dan nama pengiklan untuk transparansi.',
];

const AdsRental = () => {
  const { user } = useAuth();
  const { role, isAdmin } = useUserRole();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [slot, setSlot] = useState<SlotInfo>({ total: 2, used: 0, available: 2 });
  const [myRentals, setMyRentals] = useState<MyRental[]>([]);
  const [creating, setCreating] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<AdPackage>(PACKAGES[3]);

  // QRIS state
  const [orderId, setOrderId] = useState('');
  const [qrisPayload, setQrisPayload] = useState('');
  const [qrisAmount, setQrisAmount] = useState<number>(0);
  const [showQris, setShowQris] = useState(false);
  const [polling, setPolling] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  const activeRental = useMemo(
    () => myRentals.find((r) => r.status === 'active' && (!r.expires_at || new Date(r.expires_at) > new Date())),
    [myRentals],
  );

  // Any rental that hasn't expired yet (active OR paused/disabled OR pending payment)
  // — user only gets 1 slot per active period, regardless of pause state.
  const ownedRental = useMemo(
    () => myRentals.find(
      (r) => r.status !== 'expired' && (!r.expires_at || new Date(r.expires_at) > new Date()),
    ),
    [myRentals],
  );

  const fetchAll = async () => {
    if (!user) return;
    const [slotRes, rentalRes] = await Promise.all([
      supabase.rpc('get_ad_slot_info'),
      supabase
        .from('ad_rentals')
        .select('id, title, content, image_url, buttons, status, is_admin_slot, starts_at, expires_at, amount, order_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);
    if (slotRes.data && slotRes.data[0]) setSlot(slotRes.data[0] as any);
    if (rentalRes.data) {
      setMyRentals(
        (rentalRes.data as any[]).map((r) => ({
          ...r,
          buttons: Array.isArray(r.buttons) ? r.buttons : [],
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchAll();
    // restore QRIS
    try {
      const raw = localStorage.getItem(QRIS_KEY(user.id));
      if (raw) {
        const s = JSON.parse(raw);
        if (s.savedAt && Date.now() - s.savedAt < 30 * 60 * 1000) {
          setOrderId(s.orderId);
          setQrisPayload(s.qrisPayload);
          setQrisAmount(s.amount || 0);
          setShowQris(true);
          setPolling(s.orderId);
        } else {
          localStorage.removeItem(QRIS_KEY(user.id));
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Poll payment
  useEffect(() => {
    if (!polling) return;
    const startedAt = Date.now();
    const t = setInterval(async () => {
      if (Date.now() - startedAt > 15 * 60 * 1000) {
        setPolling(null); clearInterval(t); return;
      }
      try {
        const { data } = await supabase.functions.invoke('check-upgrade', {
          body: { order_id: polling, amount: qrisAmount },
        });
        if (data?.completed) {
          toast.success('Pembayaran berhasil! Iklan kamu aktif 🎉');
          setPaid(true);
          setPolling(null);
          setShowQris(false);
          if (user) localStorage.removeItem(QRIS_KEY(user.id));
          await fetchAll();
          clearInterval(t);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, user]);

  const startPurchase = async () => {
    if (!user) { toast.error('Silakan login dulu'); return; }
    if (slot.available <= 0) { toast.error('Slot penuh. Tunggu sampai ada iklan yang expired.'); return; }
    if (ownedRental) {
      toast.info(
        ownedRental.status === 'active'
          ? 'Kamu sudah punya iklan aktif.'
          : 'Kamu masih punya iklan yang belum expired. Aktifkan kembali atau tunggu sampai kadaluarsa.',
      );
      return;
    }
    const pkg = selectedPkg;
    const payAmount = appliedPromo?.final_amount ?? pkg.price;
    setCreating(true);
    try {
      const stamp = Date.now().toString(36).toUpperCase();
      const uid6 = user.id.slice(0, 6).toUpperCase();
      const oid = `AD-${uid6}-${stamp}`;

      // 1) Insert pending rental
      const { error: insErr } = await supabase.from('ad_rentals').insert({
        user_id: user.id,
        order_id: oid,
        status: 'pending',
        amount: payAmount,
        duration_days: pkg.days,
        title: 'Iklan Anda',
        content: '',
        buttons: [],
      });
      if (insErr) { toast.error('Gagal buat order: ' + insErr.message); return; }

      // 2) Get QRIS
      const { data, error } = await supabase.functions.invoke('create-qris', {
        body: { amount: payAmount, order_id: oid },
      });
      if (error || !data?.qris) {
        toast.error('Gagal generate QRIS: ' + (error?.message || data?.error || 'unknown'));
        await supabase.from('ad_rentals').delete().eq('order_id', oid);
        return;
      }
      // Save promo redemption (insert when payment completes — fire-and-forget on creation is safer to record only on success)
      if (appliedPromo) {
        await supabase.from('promo_redemptions').insert({
          promo_id: appliedPromo.promo_id,
          user_id: user.id,
          order_ref: oid,
          scope: 'ads',
          discount_applied: appliedPromo.discount,
        });
      }
      setOrderId(oid);
      setQrisPayload(data.qris as string);
      setQrisAmount(payAmount);
      setShowQris(true);
      setPolling(oid);
      setPaid(false);
      try {
        localStorage.setItem(QRIS_KEY(user.id), JSON.stringify({ orderId: oid, qrisPayload: data.qris, amount: payAmount, savedAt: Date.now() }));
      } catch {}
      setAppliedPromo(null);
    } finally {
      setCreating(false);
    }
  };

  const createAdminSlot = async () => {
    if (!isAdmin) return;
    const { data, error } = await supabase.rpc('create_admin_ad', {
      _title: 'Iklan Admin',
      _content: 'Konten iklan admin (edit di bawah).',
      _image_url: null,
      _buttons: [],
    });
    if (error) { toast.error('Gagal buat slot: ' + error.message); return; }
    toast.success('Slot iklan admin dibuat');
    await fetchAll();
  };

  const toggleStatus = async (r: MyRental) => {
    const newStatus = r.status === 'active' ? 'disabled' : 'active';
    const { error } = await supabase.from('ad_rentals').update({ status: newStatus }).eq('id', r.id);
    if (error) return toast.error('Gagal: ' + error.message);
    toast.success(newStatus === 'active' ? 'Iklan diaktifkan' : 'Iklan dinonaktifkan sementara');
    fetchAll();
  };

  const deleteRental = async (r: MyRental) => {
    if (!isAdmin && r.status === 'active') {
      return toast.error('Iklan aktif tidak bisa dihapus. Nonaktifkan dulu.');
    }
    if (!confirm('Hapus iklan ini?')) return;
    const { error } = await supabase.from('ad_rentals').delete().eq('id', r.id);
    if (error) return toast.error('Gagal: ' + error.message);
    toast.success('Iklan dihapus');
    fetchAll();
  };

  const handleCopy = async () => {
    const url = `https://app.pakasir.com/pay/jhonaley-store/${qrisAmount}?qris_only=1&order_id=${encodeURIComponent(orderId)}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link pembayaran disalin');
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  const editableRentals = isAdmin
    ? myRentals.filter((r) => r.is_admin_slot || r.status === 'active')
    : activeRental ? [activeRental] : [];

  return (
    <AppShell>
      <PageTransition>
        <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">

          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="p-6 relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at top right, hsl(var(--primary)) 0%, transparent 70%)' }}
              />
              <div className="relative flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/15 border border-primary/30 shrink-0">
                  <Megaphone className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold text-foreground">Sewa & Beriklan</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pasang iklan kamu sebagai popup di seluruh halaman website kami.
                  </p>
                </div>
                {!isAdmin && (
                  <div className="hidden sm:flex flex-col items-end shrink-0">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Slot tersedia</span>
                    <span className={`text-2xl font-bold ${slot.available > 0 ? 'text-primary' : 'text-destructive'}`}>
                      {slot.available} / {slot.total}
                    </span>
                    <span className="text-[10px] text-muted-foreground">slot aktif</span>
                  </div>
                )}
              </div>
            </GlassCard>
          </motion.div>

          {/* === ADMIN VIEW === */}
          {isAdmin && (
            <GlassCard className="p-5 border-amber/30">
              <div className="flex items-center gap-2 mb-3">
                <InfinityIcon className="w-5 h-5 text-amber" />
                <h2 className="text-lg font-bold text-foreground">Mode Admin — Slot Unlimited</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Sebagai admin kamu bisa membuat slot iklan tanpa bayar, tanpa batas durasi, dan tidak menghabiskan slot bulanan (2/bulan).
              </p>
              <Button onClick={createAdminSlot} className="gap-2 btn-primary">
                <Sparkles className="w-4 h-4" /> Buat Slot Iklan Baru
              </Button>
            </GlassCard>
          )}

          {/* === ACTIVE RENTALS / EDITOR === */}
          {editableRentals.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Iklan Kamu ({editableRentals.length})
              </h2>
              {editableRentals.map((r) => {
                const dl = daysLeft(r.expires_at);
                return (
                  <GlassCard key={r.id} className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md border ${
                          r.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {r.status === 'active' ? 'Aktif' : r.status}
                        </span>
                        {r.is_admin_slot ? (
                          <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-md border bg-amber/15 text-amber border-amber/30 flex items-center gap-1">
                            <InfinityIcon className="w-3 h-3" /> Unlimited
                          </span>
                        ) : r.expires_at ? (
                          <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-md border bg-primary/15 text-primary border-primary/30 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {dl} hari lagi
                          </span>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggleStatus(r)} className="gap-1.5">
                          {r.status === 'active' ? <><Pause className="w-3.5 h-3.5" /> Jeda</> : <><Play className="w-3.5 h-3.5" /> Aktifkan</>}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteRental(r)} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <AdEditor rental={r} onSaved={() => fetchAll()} />
                  </GlassCard>
                );
              })}
            </div>
          )}

          {/* === MARKETING / PURCHASE (non-admin, no active rental) === */}
          {!isAdmin && !activeRental && !showQris && (
            <>
              {/* Pricing card */}
              <GlassCard className="p-6 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-4xl font-bold text-foreground">Rp {selectedPkg.price.toLocaleString('id-ID')}</span>
                    <span className="text-sm text-muted-foreground">/ {selectedPkg.days} hari</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-5">Pilih paket di bawah — bayar sekali, iklan tayang penuh selama durasi paket.</p>

                  {/* Package picker */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
                    {PACKAGES.map((p) => {
                      const active = p.key === selectedPkg.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setSelectedPkg(p)}
                          className={`relative text-left rounded-xl p-3 border-2 transition-all ${
                            active
                              ? 'border-amber bg-gradient-to-br from-amber/15 via-primary/10 to-accent/10 shadow-lg shadow-amber/10 scale-[1.02]'
                              : 'border-border/60 bg-secondary/30 hover:border-primary/40'
                          }`}
                        >
                          {p.badge && (
                            <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-amber to-primary text-background">
                              {p.badge}
                            </span>
                          )}
                          <p className="text-sm font-bold text-foreground">{p.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Rp {p.price.toLocaleString('id-ID')}</p>
                          <p className="text-[10px] text-amber mt-1 flex items-center gap-1">
                            <Crown className="w-2.5 h-2.5" /> +{p.days}h reseller
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-amber/20 via-primary/15 to-amber/20 border border-amber/40 relative overflow-hidden">
                    <div className="flex items-start gap-3 relative">
                      <div className="p-2 rounded-lg bg-amber/20 border border-amber/40 shrink-0">
                        <Crown className="w-5 h-5 text-amber" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground flex items-center gap-2 flex-wrap">
                          🎁 BONUS GRATIS: Role Reseller {selectedPkg.days} Hari
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber text-black">GRATIS</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Otomatis aktif begitu pembayaran lunas. Sudah reseller? Masa aktif kamu diperpanjang +{selectedPkg.days} hari.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mb-6">
                    {BENEFITS.map((b) => (
                      <div key={b.title} className="flex gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
                        <b.icon className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{b.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{b.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={startPurchase}
                    disabled={creating || slot.available <= 0}
                    className="w-full sm:w-auto gap-2 btn-primary h-12 px-8 font-bold"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-5 h-5" />}
                    {slot.available <= 0
                      ? 'Slot Penuh, Tunggu Ada Expired'
                      : `Sewa ${selectedPkg.label} — Rp ${(appliedPromo?.final_amount ?? selectedPkg.price).toLocaleString('id-ID')}`}
                  </Button>
                  <div className="mt-3 max-w-md">
                    <PromoInput scope="ads" amount={selectedPkg.price} applied={appliedPromo} onApply={setAppliedPromo} />
                    {appliedPromo && (
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Harga normal:</span>
                        <span className="line-through text-muted-foreground">Rp {selectedPkg.price.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                  </div>
                  {slot.available <= 0 && (
                    <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Maks 2 slot aktif sudah terisi. Tunggu sampai ada iklan expired.
                    </p>
                  )}
                </div>
              </GlassCard>

              {/* Frequency notice */}
              <GlassCard className="p-5">
                <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" /> Cara Iklan Anda Ditampilkan
                </h3>
                <ul className="space-y-2">
                  {FREQ_NOTE.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground/85">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>

              {/* TOS */}
              <GlassCard className="p-5 border-destructive/30">
                <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-destructive" /> Ketentuan Layanan (TOS) Iklan
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Dengan menyewa slot iklan, Anda dianggap setuju dan terikat pada ketentuan berikut:
                </p>
                <ol className="space-y-2 text-xs text-foreground/85 list-decimal pl-5">
                  {TOS.map((t, i) => <li key={i}>{t}</li>)}
                </ol>
              </GlassCard>

              {/* Past rentals (history) */}
              {myRentals.length > 0 && (
                <GlassCard className="p-5">
                  <h3 className="text-base font-bold text-foreground mb-3">Riwayat Iklan</h3>
                  <div className="space-y-2">
                    {myRentals.map((r) => (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{r.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.status} • {r.starts_at ? new Date(r.starts_at).toLocaleDateString('id-ID') : '—'}
                            {r.expires_at && ` → ${new Date(r.expires_at).toLocaleDateString('id-ID')}`}
                          </p>
                        </div>
                        {r.status === 'pending' && (
                          <Button size="sm" variant="ghost" onClick={() => deleteRental(r)} className="text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
            </>
          )}

          {/* === QRIS PAYMENT === */}
          {showQris && qrisPayload && (
            <GlassCard className="p-6 relative">
              <button
                onClick={() => {
                  setShowQris(false);
                  setPolling(null);
                  if (user) localStorage.removeItem(QRIS_KEY(user.id));
                }}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-secondary hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-center space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">Scan QRIS untuk Bayar</h3>
                  <p className="text-sm text-muted-foreground">
                    Total: <span className="font-bold text-primary">Rp {qrisAmount.toLocaleString('id-ID')}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">Order: {orderId}</p>
                </div>
                <div className="inline-block p-4 bg-white rounded-xl">
                  <QRCodeSVG id="ad-qris-svg" value={qrisPayload} size={260} level="M" includeMargin={false} />
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Menunggu pembayaran… aktivasi otomatis begitu lunas.
                </div>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
                    <Copy className="w-3.5 h-3.5" /> Salin Link Bayar
                  </Button>
                </div>
              </div>
            </GlassCard>
          )}

          {paid && (
            <GlassCard className="p-5 border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                <div>
                  <p className="font-bold text-foreground">Iklan kamu sudah aktif!</p>
                  <p className="text-sm text-muted-foreground">Sekarang isi konten iklan di form di atas.</p>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      </PageTransition>
    </AppShell>
  );
};

export default AdsRental;