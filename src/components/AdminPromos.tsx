import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import GlassCard from "@/components/GlassCard";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Tag, Percent, DollarSign, Calendar, Users as UsersIcon, Copy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { RichText } from "@/components/RichText";

interface Promo {
  id: string;
  code: string;
  description: string;
  banner_url: string | null;
  discount_type: "percent" | "amount";
  discount_value: number;
  min_amount: number;
  max_discount: number | null;
  scope: "reseller" | "ads" | "both";
  quota: number | null;
  used_count: number;
  active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const emptyForm = {
  code: "",
  description: "",
  banner_url: "",
  discount_type: "percent" as "percent" | "amount",
  discount_value: 10,
  min_amount: 0,
  max_discount: 0,
  scope: "both" as "reseller" | "ads" | "both",
  quota: 0,
  active: true,
  starts_at: "",
  expires_at: "",
};

export default function AdminPromos() {
  const { user } = useAuth();
  const [items, setItems] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const fetchAll = async () => {
    const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setOpen(true);
  };

  const openEdit = (p: Promo) => {
    setEditingId(p.id);
    setForm({
      code: p.code,
      description: p.description,
      banner_url: p.banner_url || "",
      discount_type: p.discount_type,
      discount_value: p.discount_value,
      min_amount: p.min_amount,
      max_discount: p.max_discount || 0,
      scope: p.scope,
      quota: p.quota || 0,
      active: p.active,
      starts_at: p.starts_at ? p.starts_at.slice(0, 16) : "",
      expires_at: p.expires_at ? p.expires_at.slice(0, 16) : "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.code.trim()) return toast.error("Kode wajib diisi");
    if (form.discount_value <= 0) return toast.error("Nilai diskon harus > 0");
    if (form.discount_type === "percent" && form.discount_value > 100) return toast.error("Persen maks 100");
    const payload: any = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim(),
      banner_url: form.banner_url.trim() || null,
      discount_type: form.discount_type,
      discount_value: form.discount_value,
      min_amount: form.min_amount || 0,
      max_discount: form.max_discount > 0 ? form.max_discount : null,
      scope: form.scope,
      quota: form.quota > 0 ? form.quota : null,
      active: form.active,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    };
    const { error } = editingId
      ? await supabase.from("promo_codes").update(payload).eq("id", editingId)
      : await supabase.from("promo_codes").insert({ ...payload, created_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success(editingId ? "Promo diperbarui" : "Promo dibuat");

    // Broadcast notifikasi ke semua user saat promo BARU dibuat & aktif
    if (!editingId && payload.active) {
      const discountLabel = payload.discount_type === "percent"
        ? `${payload.discount_value}%`
        : fmt(payload.discount_value);
      const scopeLabel = payload.scope === "reseller" ? "upgrade Reseller"
        : payload.scope === "ads" ? "sewa Iklan"
        : "upgrade Reseller & sewa Iklan";
      const expiryNote = payload.expires_at
        ? ` Berlaku sampai ${new Date(payload.expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.`
        : "";
      const body = `Pakai kode ${payload.code} untuk diskon ${discountLabel} pada ${scopeLabel}.${payload.description ? ` ${payload.description}` : ""}${expiryNote}`;
      const { error: notifErr } = await supabase.from("notifications").insert({
        title: `🎁 Promo baru: ${payload.code}`,
        body,
        banner_url: payload.banner_url,
        link_url: "/promo",
        audience: "all",
        created_by: user?.id,
      });
      if (notifErr) toast.error("Promo dibuat, tapi notifikasi gagal: " + notifErr.message);
      else toast.success("Notifikasi promo dikirim ke semua user");
    }

    setOpen(false);
    fetchAll();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus promo ini?")) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dihapus");
    fetchAll();
  };

  const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2"><Tag className="w-5 h-5 text-primary" /> Kupon & Promo</h3>
          <p className="text-xs text-muted-foreground">Buat kode promo untuk pembelian reseller & iklan</p>
        </div>
        <Button onClick={openCreate} className="gap-2 btn-primary">
          <Plus className="w-4 h-4" /> Tambah Promo
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : items.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <Tag className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Belum ada promo. Klik "Tambah Promo" untuk membuat.</p>
        </GlassCard>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map(p => (
            <GlassCard key={p.id} className="p-4 relative overflow-hidden">
              {p.banner_url && (
                <img src={p.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10 pointer-events-none" />
              )}
              <div className="relative">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${p.active ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"}`}>
                      {p.active ? "Aktif" : "Nonaktif"}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md uppercase bg-primary/15 text-primary border border-primary/30">{p.scope}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(p.code); toast.success("Kode disalin"); }}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(p.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xl font-mono font-bold text-foreground tracking-wide">{p.code}</p>
                <p className="text-sm font-semibold text-primary mt-1">
                  {p.discount_type === "percent" ? `${p.discount_value}% OFF` : `${fmt(p.discount_value)} OFF`}
                  {p.max_discount && p.discount_type === "percent" ? ` (maks ${fmt(p.max_discount)})` : ""}
                </p>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                    <RichText text={p.description} />
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  {p.min_amount > 0 && <span>Min: {fmt(p.min_amount)}</span>}
                  <span>Dipakai: {p.used_count}{p.quota ? `/${p.quota}` : ""}</span>
                  {p.expires_at && <span>Berakhir: {new Date(p.expires_at).toLocaleDateString("id-ID")}</span>}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Promo" : "Buat Promo Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label>Kode Promo *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="HEMAT50" className="font-mono uppercase" />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Diskon spesial..." />
              <p className="text-[10px] text-muted-foreground mt-1">
                Format: <code className="text-primary">**tebal**</code>, <code className="text-primary">*miring*</code>, <code className="text-primary">__garis bawah__</code>
              </p>
            </div>
            <div>
              <Label>Banner URL (opsional)</Label>
              <Input value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipe Diskon</Label>
                <Select value={form.discount_type} onValueChange={(v: any) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent"><Percent className="w-3 h-3 inline mr-1" />Persen</SelectItem>
                    <SelectItem value="amount"><DollarSign className="w-3 h-3 inline mr-1" />Nominal Rp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nilai {form.discount_type === "percent" ? "(%)" : "(Rp)"} *</Label>
                <Input type="number" min={1} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            {form.discount_type === "percent" && (
              <div>
                <Label>Maks Diskon (Rp, opsional)</Label>
                <Input type="number" min={0} value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: parseInt(e.target.value) || 0 })} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Belanja (Rp)</Label>
                <Input type="number" min={0} value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Kuota (0 = unlimited)</Label>
                <Input type="number" min={0} value={form.quota} onChange={(e) => setForm({ ...form, quota: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Berlaku Untuk</Label>
              <Select value={form.scope} onValueChange={(v: any) => setForm({ ...form, scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Reseller & Iklan</SelectItem>
                  <SelectItem value="reseller">Reseller saja</SelectItem>
                  <SelectItem value="ads">Iklan saja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Mulai (opsional)</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <Label>Berakhir (opsional)</Label>
                <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
              <div>
                <Label className="cursor-pointer">Aktifkan promo</Label>
                <p className="text-[10px] text-muted-foreground">User bisa menggunakan kode ini</p>
              </div>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="btn-primary">{editingId ? "Simpan" : "Buat"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}