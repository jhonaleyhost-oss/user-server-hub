import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import GlassCard from "@/components/GlassCard";
import { toast } from "sonner";
import { Send, Trash2, Megaphone, Image as ImageIcon, Link as LinkIcon, Users as UsersIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Notif {
  id: string;
  title: string;
  body: string;
  banner_url: string | null;
  link_url: string | null;
  audience: string;
  created_at: string;
}

const AUDIENCES = [
  { v: "all", l: "Semua Pengguna" },
  { v: "free", l: "Free saja" },
  { v: "reseller", l: "Reseller saja" },
  { v: "premium", l: "Premium saja" },
  { v: "admin", l: "Admin saja" },
];

export default function AdminBroadcast() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [banner, setBanner] = useState("");
  const [link, setLink] = useState("");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);

  const fetchAll = async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const send = async () => {
    if (!title.trim() || !body.trim()) return toast.error("Judul & isi wajib diisi");
    setSending(true);
    const { error } = await supabase.from("notifications").insert({
      title: title.trim(),
      body: body.trim(),
      banner_url: banner.trim() || null,
      link_url: link.trim() || null,
      audience: audience as any,
      created_by: user?.id,
    });
    setSending(false);
    if (error) return toast.error("Gagal: " + error.message);
    toast.success("Notifikasi terkirim ke pengguna");
    setTitle(""); setBody(""); setBanner(""); setLink(""); setAudience("all");
    fetchAll();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus notifikasi ini?")) return;
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dihapus");
    fetchAll();
  };

  return (
    <div className="space-y-5">
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Megaphone className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg">Broadcast Notifikasi Baru</h3>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Judul *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Maintenance Server" maxLength={120} />
          </div>
          <div>
            <Label>Isi Pesan *</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tuliskan pengumuman..." rows={4} maxLength={1000} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Banner URL (opsional)</Label>
              <Input value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label className="flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Link Klik (opsional)</Label>
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/upgrade atau https://..." />
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1"><UsersIcon className="w-3 h-3" /> Target Audiens</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIENCES.map(a => <SelectItem key={a.v} value={a.v}>{a.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={send} disabled={sending} className="w-full gap-2 btn-primary">
            <Send className="w-4 h-4" /> {sending ? "Mengirim..." : "Kirim Notifikasi"}
          </Button>
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h3 className="font-bold text-lg mb-3">Riwayat Notifikasi ({items.length})</h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Belum ada notifikasi terkirim</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {items.map(n => (
              <div key={n.id} className="p-3 rounded-lg border border-border bg-secondary/30 flex gap-3">
                {n.banner_url && <img src={n.banner_url} alt="" className="w-16 h-16 object-cover rounded-md border border-border" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-semibold text-sm truncate">{n.title}</p>
                    <span className="px-1.5 py-0.5 text-[10px] rounded bg-primary/15 text-primary font-bold uppercase">{n.audience}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("id-ID")}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(n.id)} className="text-destructive shrink-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}