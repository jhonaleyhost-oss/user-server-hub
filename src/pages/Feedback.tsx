import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Send, Heart, QrCode, Loader2, Trash2, Copy, CheckCircle2, Gift } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import AppShell from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FeedbackRow {
  id: string;
  user_id: string;
  username: string;
  role: string;
  rating: number;
  message: string | null;
  created_at: string;
}

interface TipRow {
  id: string;
  user_id: string;
  username: string;
  role: string;
  amount: number;
  order_id: string;
  status: string;
  created_at: string;
}

const PAKASIR_SLUG = "jhonaley-store";
const PAKASIR_BASE = "https://app.pakasir.com";

const roleStyle = (role: string) => {
  switch (role) {
    case "admin":
      return "bg-amber/15 text-amber border-amber/30";
    case "reseller":
      return "bg-primary/15 text-primary border-primary/30";
    case "premium":
      return "bg-accent/15 text-accent border-accent/30";
    default:
      return "bg-secondary text-muted-foreground border-border";
  }
};

const roleLabel = (role: string) =>
  role === "admin" ? "Admin" : role === "reseller" ? "Reseller" : role === "premium" ? "Premium" : "Free";

const formatWIB = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
  const time = d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
    hour12: false,
  });
  return `${date} • ${time} WIB`;
};

const StarRow = ({
  value,
  onChange,
  size = 24,
  readOnly = false,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
  readOnly?: boolean;
}) => {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          onClick={() => !readOnly && onChange?.(n)}
          className={`transition-transform ${readOnly ? "cursor-default" : "cursor-pointer hover:scale-110"}`}
          aria-label={`${n} bintang`}
        >
          <Star
            style={{ width: size, height: size }}
            className={n <= active ? "fill-amber text-amber" : "text-muted-foreground/40"}
          />
        </button>
      ))}
    </div>
  );
};

const Feedback = () => {
  const { user, loading: authLoading } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();

  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Tip state
  const [amount, setAmount] = useState<string>("5000");
  const [orderId, setOrderId] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [pollingOid, setPollingOid] = useState<string | null>(null);
  const [tips, setTips] = useState<TipRow[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name?.trim() || user.email?.split("@")[0] || "Anonim");
      });
  }, [user]);

  const fetchFeedback = async () => {
    const { data, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setItems(data as FeedbackRow[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchFeedback();
    const channel = supabase
      .channel("feedback-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback" },
        (payload) => {
          setItems((prev) => [payload.new as FeedbackRow, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "feedback" },
        (payload) => {
          setItems((prev) => prev.filter((f) => f.id !== (payload.old as any).id));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch completed tips + realtime
  useEffect(() => {
    supabase
      .from("tips")
      .select("*")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setTips(data as TipRow[]);
      });

    const ch = supabase
      .channel("tips-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tips" },
        (payload) => {
          const row = (payload.new ?? payload.old) as TipRow;
          if (!row) return;
          if ((payload.new as any)?.status === "completed") {
            setTips((prev) => {
              const exists = prev.find((t) => t.id === row.id);
              if (exists) return prev.map((t) => (t.id === row.id ? (payload.new as TipRow) : t));
              return [payload.new as TipRow, ...prev];
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  // Poll Pakasir status while waiting for payment
  useEffect(() => {
    if (!pollingOid) return;
    const amt = Math.max(1000, Math.min(100000, parseInt(amount || "0", 10) || 0));
    let stopped = false;
    const startedAt = Date.now();
    const interval = setInterval(async () => {
      if (stopped) return;
      // Stop after 15 minutes
      if (Date.now() - startedAt > 15 * 60 * 1000) {
        setPollingOid(null);
        clearInterval(interval);
        return;
      }
      try {
        const { data } = await supabase.functions.invoke("check-tip", {
          body: { order_id: pollingOid, amount: amt },
        });
        if (data?.completed) {
          toast.success("Pembayaran berhasil! Terima kasih banyak 💖");
          setPollingOid(null);
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
  }, [pollingOid, amount]);

  const stats = useMemo(() => {
    if (!items.length) return { avg: 0, count: 0, dist: [0, 0, 0, 0, 0] };
    const sum = items.reduce((a, b) => a + b.rating, 0);
    const dist = [0, 0, 0, 0, 0];
    items.forEach((i) => {
      dist[i.rating - 1] += 1;
    });
    return { avg: sum / items.length, count: items.length, dist };
  }, [items]);

  const handleSubmitFeedback = async () => {
    if (!user) return;
    if (rating < 1 || rating > 5) {
      toast.error("Pilih rating 1-5 bintang terlebih dahulu");
      return;
    }
    if (message.trim().length > 500) {
      toast.error("Pesan maksimal 500 karakter");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      username: fullName || "Anonim",
      role,
      rating,
      message: message.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Gagal mengirim: " + error.message);
      return;
    }
    setRating(0);
    setMessage("");
    toast.success("Terima kasih atas feedback-nya! 🙏");
  };

  const handleDeleteFeedback = async (id: string) => {
    const { error } = await supabase.from("feedback").delete().eq("id", id);
    if (error) toast.error("Gagal menghapus: " + error.message);
  };

  const tipAmount = Math.max(1000, Math.min(100000, parseInt(amount || "0", 10) || 0));
  const validAmount = tipAmount >= 1000 && tipAmount <= 100000;

  const generatedOrderId = useMemo(
    () => orderId || `TIP-${user?.id?.slice(0, 6) ?? "guest"}-${Date.now()}`,
    [orderId, user?.id]
  );

  const pakasirUrl = `${PAKASIR_BASE}/pay/${PAKASIR_SLUG}/${tipAmount}?qris_only=1&order_id=${encodeURIComponent(
    generatedOrderId
  )}`;

  const handleOpenQris = async () => {
    if (!user) return;
    if (!validAmount) {
      toast.error("Nominal harus antara Rp 1.000 - Rp 100.000");
      return;
    }
    const oid = generatedOrderId;
    setOrderId(oid);
    await supabase.from("tips").insert({
      user_id: user.id,
      username: fullName || "Anonim",
      role,
      amount: tipAmount,
      order_id: oid,
      status: "pending",
    });
    setPollingOid(oid);
    window.open(pakasirUrl, "_blank", "noopener,noreferrer");
    toast.success("Halaman QRIS dibuka. Status pembayaran akan dicek otomatis.");
  };

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(pakasirUrl);
    toast.success("Link pembayaran disalin");
  };

  const presetAmounts = [2000, 5000, 10000, 25000, 50000, 100000];

  return (
    <AppShell>
      <PageTransition>
        <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* Header / Average */}
          <GlassCard className="p-6 text-center">
            <h1 className="text-2xl font-bold text-foreground mb-1">Rating & Feedback</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Beri tahu kami pengalamanmu menggunakan Jhonaley Store
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="text-5xl font-extrabold bg-gradient-to-br from-amber to-primary bg-clip-text text-transparent">
                {stats.avg.toFixed(1)}
              </div>
              <div className="text-left">
                <div className="text-sm text-muted-foreground">/ 5.0</div>
                <div className="text-xs text-muted-foreground">{stats.count} ulasan</div>
              </div>
            </div>
            <div className="flex justify-center mt-2">
              <StarRow value={Math.round(stats.avg)} readOnly size={22} />
            </div>
          </GlassCard>

          {/* Submit feedback */}
          <GlassCard className="p-5">
            <h2 className="text-lg font-bold text-foreground mb-3">Tulis Ulasan</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Rating kamu</label>
                <StarRow value={rating} onChange={setRating} size={32} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Pesan (opsional)</label>
                <Textarea
                  placeholder="Ceritakan pengalamanmu..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                  className="min-h-[90px]"
                />
                <div className="text-[10px] text-right text-muted-foreground mt-1">
                  {message.length}/500
                </div>
              </div>
              <Button
                onClick={handleSubmitFeedback}
                disabled={submitting || rating < 1}
                className="w-full h-11 gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Kirim Feedback
              </Button>
            </div>
          </GlassCard>

          {/* Tip jar */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-5 h-5 text-rose-400 fill-rose-400" />
              <h2 className="text-lg font-bold text-foreground">Beri Tip via QRIS</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Dukung kami untuk terus menghadirkan layanan terbaik 🙏
            </p>

            <label className="text-xs text-muted-foreground mb-1 block">Nominal (Rp 1.000 - Rp 100.000)</label>
            <Input
              type="number"
              inputMode="numeric"
              min={1000}
              max={100000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000"
              className="h-11"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {presetAmounts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    tipAmount === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/40 border-border hover:bg-secondary"
                  }`}
                >
                  Rp {p.toLocaleString("id-ID")}
                </button>
              ))}
            </div>

            {/* QRIS Canvas */}
            {validAmount && (
              <div className="mt-4 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-fuchsia-500/30 border border-white/10 p-3 space-y-3">
                {/* Header */}
                <div className="rounded-xl bg-background/70 backdrop-blur px-4 py-3 text-center border border-white/10">
                  <div className="text-base font-extrabold tracking-wide bg-gradient-to-r from-primary via-accent to-amber bg-clip-text text-transparent">
                    ⚡ ORDER TIP ⚡
                  </div>
                  <div className="text-[11px] text-muted-foreground">Scan to Pay</div>
                </div>

                {/* Total */}
                <div className="rounded-xl px-4 py-3 text-center bg-gradient-to-r from-rose-500 to-fuchsia-500 text-white shadow-lg">
                  <div className="text-[11px] font-semibold opacity-90">🧾 TOTAL PEMBAYARAN</div>
                  <div className="text-2xl font-extrabold">Rp {tipAmount.toLocaleString("id-ID")}</div>
                </div>

                {/* QR */}
                <div className="relative mx-auto bg-white rounded-2xl p-5 w-full max-w-[280px]">
                  {/* Corner brackets */}
                  <span className="absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-fuchsia-400 rounded-tl-md" />
                  <span className="absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-fuchsia-400 rounded-tr-md" />
                  <span className="absolute bottom-2 left-2 w-5 h-5 border-b-2 border-l-2 border-fuchsia-400 rounded-bl-md" />
                  <span className="absolute bottom-2 right-2 w-5 h-5 border-b-2 border-r-2 border-fuchsia-400 rounded-br-md" />
                  <div className="relative flex items-center justify-center">
                    <QRCodeSVG
                      value={pakasirUrl}
                      size={232}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#0a0a0a"
                      marginSize={0}
                    />
                    {/* Center logo */}
                    <div className="absolute w-12 h-12 rounded-full bg-white border-2 border-fuchsia-400 flex items-center justify-center shadow">
                      <span className="font-extrabold text-sm bg-gradient-to-br from-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">JN</span>
                    </div>
                  </div>
                </div>

                {/* Methods */}
                <div className="text-center text-[10px] font-semibold text-muted-foreground">
                  ▦ SUPPORTED PAYMENT METHODS ▦
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "DANA", color: "from-sky-500 to-blue-600" },
                    { label: "OVO", color: "from-purple-500 to-indigo-600" },
                    { label: "GOPAY", color: "from-emerald-500 to-green-600" },
                    { label: "BANK", color: "from-rose-500 to-red-600" },
                  ].map((m) => (
                    <div
                      key={m.label}
                      className={`text-center text-[11px] font-bold text-white py-1.5 rounded-lg bg-gradient-to-br ${m.color} shadow`}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>

                {/* Secure */}
                <div className="rounded-xl bg-background/70 backdrop-blur px-4 py-2 text-center border border-white/10">
                  <div className="text-[11px] font-bold text-foreground">🔒 SECURE PAYMENT</div>
                  <div className="text-[10px] text-muted-foreground">Protected by QRIS • Jhonaley Store</div>
                </div>

                <div className="text-center text-[10px] text-muted-foreground tracking-widest">
                  REF: {generatedOrderId.slice(-8).toUpperCase()}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button onClick={handleOpenQris} className="h-10 gap-2">
                    <QrCode className="w-4 h-4" />
                    Buka di App
                  </Button>
                  <Button onClick={handleCopyUrl} variant="outline" className="h-10 gap-2">
                    <Copy className="w-4 h-4" />
                    Salin Link
                  </Button>
                </div>
                {pollingOid && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Menunggu konfirmasi pembayaran...
                  </div>
                )}
              </div>
            )}
            {!validAmount && (
              <p className="text-xs text-center text-muted-foreground mt-4">
                Masukkan nominal Rp 1.000 - Rp 100.000 untuk menampilkan QRIS
              </p>
            )}

            <div className="mt-5 p-3 rounded-lg bg-gradient-to-br from-amber/10 via-primary/10 to-accent/10 border border-amber/20 text-center">
              <p className="text-sm font-semibold text-foreground">Terima kasih banyak 💖</p>
              <p className="text-xs text-muted-foreground mt-1">
                Semoga rezekimu selalu dilancarkan, sehat selalu, dan dimudahkan dalam segala urusan. Aamiin 🤲
              </p>
            </div>
          </GlassCard>

          {/* Donor list */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="w-5 h-5 text-amber" />
              <h2 className="text-lg font-bold text-foreground">Donatur Terbaru ({tips.length})</h2>
            </div>
            {tips.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Belum ada donatur. Jadilah yang pertama 💝
              </p>
            ) : (
              <div className="space-y-2">
                {tips.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 via-secondary/30 to-amber/10 border border-emerald-500/20 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {t.username}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${roleStyle(
                            t.role
                          )}`}
                        >
                          {roleLabel(t.role)}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatWIB(t.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-extrabold bg-gradient-to-r from-emerald-400 to-amber bg-clip-text text-transparent">
                        Rp {t.amount.toLocaleString("id-ID")}
                      </div>
                      <div className="text-[9px] text-muted-foreground">QRIS</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* Feedback list */}
          <GlassCard className="p-5">
            <h2 className="text-lg font-bold text-foreground mb-3">
              Ulasan Pengguna ({stats.count})
            </h2>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Belum ada ulasan. Jadilah yang pertama!
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((f) => {
                  const canDelete = user?.id === f.user_id || role === "admin";
                  return (
                    <div
                      key={f.id}
                      className="p-3 rounded-lg bg-secondary/30 border border-border/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground truncate">
                              {f.username}
                            </span>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${roleStyle(
                                f.role
                              )}`}
                            >
                              {roleLabel(f.role)}
                            </span>
                          </div>
                          <div className="mt-1">
                            <StarRow value={f.rating} readOnly size={14} />
                          </div>
                        </div>
                        {canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => handleDeleteFeedback(f.id)}
                            aria-label="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      {f.message && (
                        <p className="text-sm text-foreground/90 mt-2 whitespace-pre-wrap break-words">
                          {f.message}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {formatWIB(f.created_at)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      </PageTransition>
    </AppShell>
  );
};

export default Feedback;