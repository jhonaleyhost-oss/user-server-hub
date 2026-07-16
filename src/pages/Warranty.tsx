import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, ShieldCheck, ImagePlus, Loader2, X, Calendar, Clock,
  CheckCircle2, XCircle, AlertCircle, Info, Upload, Crown,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ImageLightbox from "@/components/ImageLightbox";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status = "pending" | "approved" | "rejected";
type ReqRole = "reseller" | "adp_server" | "premium";

interface Claim {
  id: string;
  invoice_image_url: string;
  invoice_storage_path: string | null;
  invoice_image_paths: string[] | null;
  purchase_at: string;
  requested_role: ReqRole;
  duration_months: number | null;
  permanent: boolean;
  user_note: string | null;
  status: Status;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const ROLE_LABEL: Record<ReqRole, string> = {
  reseller: "Reseller",
  adp_server: "Admin Panel (ADP)",
  premium: "Premium",
};

const StatusBadge = ({ status }: { status: Status }) => {
  const map = {
    pending: { icon: Clock, cls: "bg-amber/15 text-amber border-amber/30", label: "Menunggu" },
    approved: { icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Disetujui" },
    rejected: { icon: XCircle, cls: "bg-destructive/15 text-destructive border-destructive/30", label: "Ditolak" },
  }[status];
  const Icon = map.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${map.cls}`}>
      <Icon className="w-3 h-3" /> {map.label}
    </span>
  );
};

const SignedThumb = ({ path, onOpen }: { path: string | null; onOpen: (url: string) => void }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    supabase.storage.from("warranty-invoices").createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (active && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [path]);
  if (!url) {
    return <div className="w-16 h-16 rounded-lg bg-secondary animate-pulse" />;
  }
  return (
    <button type="button" onClick={() => onOpen(url)} className="shrink-0">
      <img src={url} alt="Invoice" className="w-16 h-16 rounded-lg object-cover border border-border/60 hover:opacity-80 transition" />
    </button>
  );
};

const MAX_IMAGES = 10;
const MAX_SIZE_MB = 5;

const Warranty = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [purchaseDate, setPurchaseDate] = useState<string>("");
  const [purchaseTime, setPurchaseTime] = useState<string>("");
  const [role, setRole] = useState<ReqRole>("reseller");
  const [durationType, setDurationType] = useState<"months" | "permanent">("months");
  const [months, setMonths] = useState<number>(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchClaims();
  }, [authLoading, user, navigate]);

  const fetchClaims = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("role_warranty_claims")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Gagal memuat riwayat garansi");
    } else {
      setClaims((data as any) || []);
    }
    setLoading(false);
  };

  const onPickFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const incoming = Array.from(list);
    const remaining = MAX_IMAGES - files.length;
    if (remaining <= 0) {
      toast.error(`Maksimal ${MAX_IMAGES} gambar`);
      return;
    }
    const accepted: File[] = [];
    for (const f of incoming.slice(0, remaining)) {
      if (!f.type.startsWith("image/")) {
        toast.error(`"${f.name}" bukan gambar, dilewati`);
        continue;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`"${f.name}" melebihi ${MAX_SIZE_MB}MB, dilewati`);
        continue;
      }
      accepted.push(f);
    }
    if (incoming.length > remaining) {
      toast.error(`Hanya ${remaining} gambar pertama yang ditambahkan (batas ${MAX_IMAGES})`);
    }
    if (accepted.length === 0) return;
    setFiles((prev) => [...prev, ...accepted]);
    setPreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const resetForm = () => {
    previews.forEach((u) => URL.revokeObjectURL(u));
    setFiles([]);
    setPreviews([]);
    setPurchaseDate("");
    setPurchaseTime("");
    setRole("reseller");
    setDurationType("months");
    setMonths(1);
    setNote("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!user) return;
    if (files.length === 0) return toast.error("Wajib upload minimal 1 screenshot invoice");
    if (!purchaseDate) return toast.error("Tanggal pembelian wajib diisi");
    if (!purchaseTime) return toast.error("Jam pembelian wajib diisi");
    if (durationType === "months" && (!months || months < 1 || months > 60)) {
      return toast.error("Durasi harus 1-60 bulan");
    }

    // Prevent duplicate pending claim
    if (claims.some((c) => c.status === "pending")) {
      return toast.error("Kamu masih punya klaim menunggu. Tunggu review admin dulu.");
    }

    setSubmitting(true);
    try {
      const purchaseAt = new Date(`${purchaseDate}T${purchaseTime}:00`);
      if (isNaN(purchaseAt.getTime())) throw new Error("Tanggal/jam tidak valid");
      if (purchaseAt.getTime() > Date.now()) throw new Error("Tanggal pembelian tidak boleh di masa depan");

      const paths: string[] = [];
      for (const f of files) {
        const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("warranty-invoices")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (upErr) throw upErr;
        paths.push(path);
      }

      const { error: insErr } = await supabase.from("role_warranty_claims").insert({
        user_id: user.id,
        invoice_image_url: paths[0],
        invoice_storage_path: paths[0],
        invoice_image_paths: paths,
        purchase_at: purchaseAt.toISOString(),
        requested_role: role,
        duration_months: durationType === "months" ? months : null,
        permanent: durationType === "permanent",
        user_note: note.trim() || null,
      });
      if (insErr) throw insErr;

      toast.success("Klaim garansi terkirim! Menunggu review admin.");
      resetForm();
      fetchClaims();
    } catch (e: any) {
      toast.error(e.message || "Gagal mengirim klaim");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="min-h-screen py-6 px-4 bg-background">
          <div className="w-full max-w-4xl mx-auto space-y-5">
            {/* Header */}
            <GlassCard className="p-4 sm:p-5 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-primary/10 pointer-events-none" />
              <div className="relative flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Kembali">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-500/80 to-primary/40 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-lg sm:text-xl">Garansi Role</h1>
                  <p className="text-xs text-muted-foreground">
                    Ajukan pemulihan role yang hilang / hangus. Wajib lampirkan bukti invoice.
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Info card */}
            <GlassCard className="p-4 border-blue-500/30 bg-blue-500/5">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="text-foreground font-semibold text-sm">Cara Klaim Garansi</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Upload screenshot invoice pembayaran (jelas & tidak dipotong)</li>
                    <li>Isi tanggal & jam pembelian sesuai invoice</li>
                    <li>Pilih role yang kamu beli dan durasinya</li>
                    <li>Admin akan review 1x24 jam. Setelah disetujui, role otomatis aktif.</li>
                  </ul>
                </div>
              </div>
            </GlassCard>

            {/* Form */}
            <GlassCard className="p-4 sm:p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-primary" />
                <h2 className="font-semibold">Ajukan Klaim Baru</h2>
              </div>

              {/* Invoice image */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Screenshot Invoice <span className="text-destructive">*</span></Label>
                  <span className="text-[10px] text-muted-foreground">
                    {previews.length}/{MAX_IMAGES} gambar
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {previews.map((src, i) => (
                    <div key={src} className="relative">
                      <img
                        src={src}
                        alt={`Preview ${i + 1}`}
                        className="w-24 h-24 rounded-xl object-cover border border-border"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow"
                        aria-label="Hapus gambar"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <span className="absolute bottom-1 left-1 text-[10px] font-semibold bg-black/60 text-white px-1 rounded">
                        {i + 1}
                      </span>
                    </div>
                  ))}
                  {previews.length < MAX_IMAGES && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="w-24 h-24 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-secondary/30 flex flex-col items-center justify-center gap-1 text-muted-foreground transition"
                    >
                      <ImagePlus className="w-6 h-6" />
                      <span className="text-[10px]">Tambah</span>
                      <span className="text-[9px]">Max {MAX_SIZE_MB}MB</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Bisa upload hingga {MAX_IMAGES} gambar (invoice, bukti transfer, chat, dsb).
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickFiles(e.target.files)}
                />
              </div>

              {/* Date & time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tanggal Pembelian <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jam Pembelian <span className="text-destructive">*</span></Label>
                  <Input
                    type="time"
                    value={purchaseTime}
                    onChange={(e) => setPurchaseTime(e.target.value)}
                  />
                </div>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label>Role yang Dibeli <span className="text-destructive">*</span></Label>
                <Select value={role} onValueChange={(v) => setRole(v as ReqRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reseller">Reseller</SelectItem>
                    <SelectItem value="adp_server">Admin Panel (ADP Server)</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label>Masa Aktif <span className="text-destructive">*</span></Label>
                <RadioGroup
                  value={durationType}
                  onValueChange={(v) => setDurationType(v as any)}
                  className="grid grid-cols-2 gap-3"
                >
                  <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition ${durationType === "months" ? "border-primary bg-primary/5" : "border-border"}`}>
                    <RadioGroupItem value="months" />
                    <span className="text-sm font-medium">Bulanan</span>
                  </label>
                  <label className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition ${durationType === "permanent" ? "border-amber bg-amber/5" : "border-border"}`}>
                    <RadioGroupItem value="permanent" />
                    <span className="text-sm font-medium flex items-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-amber" /> Permanen
                    </span>
                  </label>
                </RadioGroup>
                {durationType === "months" && (
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={months}
                    onChange={(e) => setMonths(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                    placeholder="Jumlah bulan"
                    className="mt-2"
                  />
                )}
              </div>

              {/* Note */}
              <div className="space-y-2">
                <Label>Catatan Tambahan (opsional)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contoh: order ID, metode bayar, kronologi role hilang..."
                  rows={3}
                  maxLength={500}
                />
                <p className="text-[10px] text-muted-foreground text-right">{note.length}/500</p>
              </div>

              <Button onClick={submit} disabled={submitting} className="w-full h-11 gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {submitting ? "Mengirim..." : "Ajukan Klaim Garansi"}
              </Button>
            </GlassCard>

            {/* History */}
            <GlassCard className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Riwayat Klaim Saya</h2>
                <Badge variant="outline">{claims.length}</Badge>
              </div>
              {loading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : claims.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Belum ada klaim garansi
                </div>
              ) : (
                <div className="space-y-3">
                  {claims.map((c) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl border border-border/60 bg-secondary/20 flex gap-3"
                    >
                      <SignedThumb path={c.invoice_storage_path || c.invoice_image_url} onOpen={setLightbox} />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{ROLE_LABEL[c.requested_role]}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.permanent ? "Permanen" : `${c.duration_months} bulan`}
                          </span>
                          <StatusBadge status={c.status} />
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Beli: {new Date(c.purchase_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Diajukan: {new Date(c.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                        </div>
                        {c.user_note && (
                          <p className="text-xs text-foreground/80 bg-background/40 rounded p-2 border border-border/40">
                            "{c.user_note}"
                          </p>
                        )}
                        {c.admin_note && (
                          <p className={`text-xs rounded p-2 border ${c.status === "rejected" ? "bg-destructive/5 border-destructive/30 text-destructive" : "bg-emerald-500/5 border-emerald-500/30 text-emerald-400"}`}>
                            <span className="font-semibold">Admin: </span>{c.admin_note}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </div>

        <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
      </PageTransition>
    </AppShell>
  );
};

export default Warranty;