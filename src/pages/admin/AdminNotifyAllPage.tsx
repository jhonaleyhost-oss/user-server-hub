import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Send, BellRing, Link as LinkIcon, Image as ImageIcon, Smartphone, ShieldAlert } from "lucide-react";
import { enablePushNotifications, webPushSupported } from "@/lib/webPush";

const AdminNotifyAllPage = () => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState("");
  const [url, setUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [devices, setDevices] = useState<number | null>(null);

  const loadDevices = async () => {
    const { count } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true });
    setDevices(count ?? 0);
  };

  useEffect(() => { loadDevices(); }, []);

  const send = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Judul & isi wajib diisi");
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: { title: title.trim(), body: body.trim(), url: url.trim() || "/", image: image.trim() || undefined },
    });
    setSending(false);
    if (error) return toast.error("Gagal kirim: " + error.message);
    if ((data as any)?.error) return toast.error("Gagal: " + (data as any).error);
    const d = data as { sent: number; total: number; failed: number };
    toast.success(`Push terkirim ke ${d.sent}/${d.total} perangkat`);
    setTitle(""); setBody(""); setImage(""); setUrl("");
    loadDevices();
  };

  return (
    <AdminLayout title="Kirim Notifikasi HP" description="Push notification langsung ke perangkat, tidak tercatat di web">
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <BellRing className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">Push Notification Baru</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
            <Smartphone className="w-3 h-3" /> Target:{" "}
            <span className="font-semibold text-foreground">
              {devices === null ? "menghitung..." : `${devices} perangkat terdaftar`}
            </span>
          </p>
          <div className="space-y-3">
            <div>
              <Label>Judul *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Promo Spesial Hari Ini" maxLength={120} />
            </div>
            <div>
              <Label>Isi Pesan *</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tuliskan pesan singkat..." rows={4} maxLength={500} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Gambar URL (opsional)</Label>
              <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label className="flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Link Saat Diklik (opsional)</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/promo atau https://..." />
            </div>
            <Button onClick={send} disabled={sending} className="w-full gap-2 btn-primary">
              <Send className="w-4 h-4" /> {sending ? "Mengirim..." : "Kirim Push ke Semua Perangkat"}
            </Button>
          </div>
        </GlassCard>

        <div className="space-y-5">
          <GlassCard className="p-5">
            <h3 className="font-bold text-lg mb-3">Pratinjau</h3>
            <div className="p-3 rounded-xl border border-border bg-secondary/40 flex gap-3">
              <img src="/icon-192.png" alt="Ikon aplikasi" className="w-9 h-9 rounded-lg border border-border" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{title.trim() || "Judul notifikasi"}</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">{body.trim() || "Isi pesan akan tampil di sini."}</p>
                {image.trim() && <img src={image} alt="Pratinjau gambar notifikasi" className="mt-2 w-full h-24 object-cover rounded-md border border-border" />}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              <h3 className="font-bold">Catatan</h3>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>Notifikasi ini <b>tidak</b> disimpan di database dan tidak muncul di lonceng notifikasi web.</li>
              <li>Hanya sampai ke perangkat yang sudah mengizinkan notifikasi (otomatis terdaftar saat pengguna login).</li>
              <li>Di iPhone, push hanya jalan jika situs sudah ditambahkan ke Home Screen.</li>
              <li>Push nyata hanya bekerja di domain yang sudah dipublish (HTTPS), bukan di preview editor.</li>
            </ul>
            {webPushSupported() && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-2"
                onClick={async () => {
                  const ok = await enablePushNotifications();
                  toast[ok ? "success" : "error"](ok ? "Perangkat ini terdaftar" : "Gagal mendaftarkan perangkat");
                  loadDevices();
                }}
              >
                <Smartphone className="w-4 h-4" /> Daftarkan perangkat ini
              </Button>
            )}
          </GlassCard>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminNotifyAllPage;
