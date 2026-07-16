import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2, ShieldCheck, XCircle, CheckCircle2, Clock, Calendar,
  Mail, User as UserIcon, Crown, Filter, RefreshCw, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ImageLightbox from "@/components/ImageLightbox";
import { toast } from "sonner";

type Status = "pending" | "approved" | "rejected";
type ReqRole = "reseller" | "adp_server" | "premium";

interface Claim {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  active_role: string;
  invoice_image_url: string;
  invoice_storage_path: string | null;
  purchase_at: string;
  requested_role: ReqRole;
  duration_months: number | null;
  permanent: boolean;
  user_note: string | null;
  status: Status;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const ROLE_LABEL: Record<ReqRole, string> = {
  reseller: "Reseller",
  adp_server: "Admin Panel",
  premium: "Premium",
};

const ROLE_STYLE: Record<ReqRole, string> = {
  reseller: "bg-primary/15 text-primary border-primary/30",
  adp_server: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  premium: "bg-accent/15 text-accent border-accent/30",
};

const StatusChip = ({ status }: { status: Status }) => {
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

const SignedImage = ({ path, onClick }: { path: string | null; onClick: (url: string) => void }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    supabase.storage.from("warranty-invoices").createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (active && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { active = false; };
  }, [path]);
  if (!url) return <div className="w-24 h-24 rounded-lg bg-secondary animate-pulse shrink-0" />;
  return (
    <button type="button" onClick={() => onClick(url)} className="shrink-0">
      <img src={url} alt="Invoice" className="w-24 h-24 rounded-lg object-cover border border-border/60 hover:opacity-80 transition" />
    </button>
  );
};

const AdminWarrantyClaims = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Dialog state
  const [action, setAction] = useState<{ type: "approve" | "reject"; claim: Claim } | null>(null);
  const [adminNote, setAdminNote] = useState("");

  const fetchClaims = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_warranty_claims", {
      _status: filter === "all" ? null : filter,
      _limit: 200,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setClaims((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClaims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const openAction = (type: "approve" | "reject", claim: Claim) => {
    setAction({ type, claim });
    setAdminNote("");
  };

  const submitAction = async () => {
    if (!action) return;
    setBusyId(action.claim.id);
    try {
      const fn = action.type === "approve" ? "approve_warranty_claim" : "reject_warranty_claim";
      const { data, error } = await supabase.rpc(fn, {
        _claim_id: action.claim.id,
        _admin_note: adminNote.trim() || null,
      });
      if (error) throw error;
      const res = data as any;
      if (res?.success === false) throw new Error(res.error || "Gagal");

      toast.success(action.type === "approve" ? "Klaim disetujui & role diaktifkan" : "Klaim ditolak");
      setAction(null);
      fetchClaims();
    } catch (e: any) {
      toast.error(e.message || "Gagal memproses");
    } finally {
      setBusyId(null);
    }
  };

  const counts = {
    pending: claims.filter((c) => c.status === "pending").length,
    approved: claims.filter((c) => c.status === "approved").length,
    rejected: claims.filter((c) => c.status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Menunggu ({counts.pending})</SelectItem>
              <SelectItem value="approved">Disetujui</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
              <SelectItem value="all">Semua</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={fetchClaims} disabled={loading} className="gap-2">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <div className="sm:ml-auto text-xs text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{claims.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : claims.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          Tidak ada klaim {filter !== "all" ? `berstatus ${filter}` : ""}
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border border-border bg-card/50 space-y-3"
            >
              {/* Header row: user + status */}
              <div className="flex items-start gap-3">
                {c.avatar_url ? (
                  <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold shrink-0">
                    {(c.full_name || c.email || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm flex items-center gap-1">
                      <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      {c.full_name || "Tanpa nama"}
                    </span>
                    <StatusChip status={c.status} />
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3" /> {c.email || "-"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Role aktif: <span className="font-semibold text-foreground">{c.active_role}</span>
                  </div>
                </div>
              </div>

              {/* Content: image + details */}
              <div className="flex gap-3">
                <SignedImage path={c.invoice_storage_path || c.invoice_image_url} onClick={setLightbox} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold uppercase tracking-wide ${ROLE_STYLE[c.requested_role]}`}>
                      {ROLE_LABEL[c.requested_role]}
                    </span>
                    <Badge variant="outline" className="gap-1">
                      {c.permanent ? (
                        <><Crown className="w-3 h-3 text-amber" /> Permanen</>
                      ) : (
                        <>{c.duration_months} bulan</>
                      )}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Beli: {new Date(c.purchase_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Diajukan: {new Date(c.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                  {c.reviewed_at && (
                    <div className="text-[11px] text-muted-foreground">
                      Direview: {new Date(c.reviewed_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </div>
                  )}
                  {c.user_note && (
                    <p className="text-xs text-foreground/80 bg-background/40 rounded p-2 border border-border/40">
                      <span className="font-semibold">Catatan user: </span>{c.user_note}
                    </p>
                  )}
                  {c.admin_note && (
                    <p className={`text-xs rounded p-2 border ${c.status === "rejected" ? "bg-destructive/5 border-destructive/30 text-destructive" : "bg-emerald-500/5 border-emerald-500/30 text-emerald-400"}`}>
                      <span className="font-semibold">Admin: </span>{c.admin_note}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {c.status === "pending" && (
                <div className="flex gap-2 pt-1 border-t border-border/40">
                  <Button
                    size="sm"
                    onClick={() => openAction("approve", c)}
                    disabled={busyId === c.id}
                    className="flex-1 gap-1 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Setujui
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => openAction("reject", c)}
                    disabled={busyId === c.id}
                    className="flex-1 gap-1"
                  >
                    <XCircle className="w-4 h-4" /> Tolak
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={!!action} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {action?.type === "approve" ? (
                <><ShieldCheck className="w-5 h-5 text-emerald-500" /> Setujui Klaim Garansi</>
              ) : (
                <><XCircle className="w-5 h-5 text-destructive" /> Tolak Klaim Garansi</>
              )}
            </DialogTitle>
            <DialogDescription>
              {action?.type === "approve" ? (
                <>
                  Role <span className="font-bold text-foreground">{action && ROLE_LABEL[action.claim.requested_role]}</span>
                  {action?.claim.permanent
                    ? " (Permanen)"
                    : ` (${action?.claim.duration_months} bulan)`}
                  {" "}akan langsung aktif untuk{" "}
                  <span className="font-bold text-foreground">{action?.claim.full_name || action?.claim.email}</span>.
                </>
              ) : (
                <>Klaim akan ditolak. Berikan alasan agar user paham.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder={action?.type === "approve" ? "Catatan opsional untuk user..." : "Alasan penolakan (mis. invoice tidak jelas, tanggal tidak cocok)..."}
              rows={3}
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground text-right">{adminNote.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Batal</Button>
            <Button
              onClick={submitAction}
              disabled={busyId === action?.claim.id || (action?.type === "reject" && !adminNote.trim())}
              className={action?.type === "approve" ? "bg-emerald-500 hover:bg-emerald-600 text-black font-semibold" : ""}
              variant={action?.type === "reject" ? "destructive" : "default"}
            >
              {busyId === action?.claim.id ? <Loader2 className="w-4 h-4 animate-spin" /> : action?.type === "approve" ? "Setujui & Aktifkan" : "Tolak Klaim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImageLightbox src={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
};

export default AdminWarrantyClaims;