import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import GlassCard from "@/components/GlassCard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Send, BellRing, Link as LinkIcon, Image as ImageIcon, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const AdminNotifyAllPage = () => {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [banner, setBanner] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Judul & isi wajib diisi");
    setSending(true);
    const { error } = await supabase.from("notifications").insert({
      title: title.trim(),
      body: body.trim(),
      banner_url: banner.trim() || null,
      link_url: link.trim() || null,
      audience: "all" as any,
      created_by: user?.id,
    });
    setSending(false);
    if (error) return toast.error("Gagal: " + error.message);
    toast.success("Notifikasi terkirim ke semua pengguna");
    setTitle(""); setBody(""); setBanner(""); setLink("");
  };

  return (
    <AdminLayout title="Kirim Notifikasi" description="Notifikasi khusus untuk semua pengguna">
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <BellRing className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg">Notifikasi Baru</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
            <Users className="w-3 h-3" /> Target: <span className="font-semibold text-foreground">Semua Pengguna</span>
          </p>
          <div className="space-y-3">
            <div>
              <Label>Judul *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Maintenance Server" maxLength={120} />
            </div>
            <div>
              <Label>Isi Pesan *</Label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tuliskan pengumuman..." rows={5} maxLength={1000} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Banner URL (opsional)</Label>
              <Input value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label className="flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Link Klik (opsional)</Label>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/upgrade atau https://..." />
            </div>
            <Button onClick={send} disabled={sending} className="w-full gap-2 btn-primary">
              <Send className="w-4 h-4" /> {sending ? "Mengirim..." : "Kirim ke Semua Pengguna"}
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="font-bold text-lg mb-3">Pratinjau</h3>
          <div className="p-3 rounded-lg border border-border bg-secondary/30 flex gap-3">
            {banner.trim() && <img src={banner} alt="Pratinjau banner notifikasi" className="w-16 h-16 object-cover rounded-md border border-border" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{title.trim() || "Judul notifikasi"}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{body.trim() || "Isi pesan akan tampil di sini."}</p>
              {link.trim() && <p className="text-[11px] text-primary mt-1 truncate">{link}</p>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Notifikasi masuk ke lonceng notifikasi semua pengguna. Riwayat lengkap bisa dilihat di halaman Broadcast.
          </p>
        </GlassCard>
      </div>
    </AdminLayout>
  );
};

export default AdminNotifyAllPage;
