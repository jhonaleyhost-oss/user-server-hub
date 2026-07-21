import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Send, MessageCircle, Loader2, ArrowRight, Megaphone, BadgeCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const categories = [
  { value: "general", label: "Pertanyaan Umum" },
  { value: "technical", label: "Kendala Teknis" },
  { value: "billing", label: "Pembayaran / Upgrade" },
  { value: "partnership", label: "Kerja Sama / Partnership" },
];

const telegramLinks = [
  { label: "CS Jhonaley Store", url: "https://t.me/jhonaleystorecs" },
  { label: "Jhonaley Store ID", url: "https://t.me/jhonaleystoreid" },
  { label: "Limit Bot", url: "https://t.me/jhonaleylimitbot" },
];

const OFFICIAL_CHANNEL = "https://t.me/jhonaleytesti3";

const ContactSection = () => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    category: "general",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-support`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim pesan");
      toast.success("Pesan berhasil dikirim. Tim kami akan membalas via email.");
      setForm({ name: "", email: "", category: "general", message: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim pesan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="py-20 border-t border-border/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">Hubungi Kami</h2>
          <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
            Punya pertanyaan? Kirim pesan lewat form di bawah atau hubungi kami via Telegram.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            onSubmit={handleSubmit}
            className="glass-card rounded-2xl p-6 sm:p-8 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="Nama Anda"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  maxLength={255}
                  placeholder="email@anda.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Kategori</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
                required
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Pesan</Label>
              <Textarea
                id="message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                required
                minLength={10}
                maxLength={2000}
                placeholder="Jelaskan pertanyaan atau kendala Anda..."
                rows={5}
              />
            </div>
            <Button type="submit" className="w-full btn-primary flex items-center gap-2" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{loading ? "Mengirim..." : "Kirim Pesan"}</span>
            </Button>
          </motion.form>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-2xl p-6 sm:p-8 space-y-6"
          >
            <div>
              <h3 className="text-xl font-bold mb-2">Kontak Telegram</h3>
              <p className="text-sm text-muted-foreground">
                Pilih salah satu channel Telegram untuk respon lebih cepat.
              </p>
            </div>
            <div className="space-y-3">
              {telegramLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:border-primary/50 hover:bg-primary/5 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-medium">{link.label}</span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition" />
                </a>
              ))}
            </div>

            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Channel Resmi</span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <a
                href={OFFICIAL_CHANNEL}
                target="_blank"
                rel="noreferrer"
                className="relative flex items-center justify-between p-4 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/10 via-accent/5 to-transparent hover:border-primary/70 transition group overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <Megaphone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">Channel Telegram Resmi</span>
                      <BadgeCheck className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-xs text-muted-foreground">Update, promo & pengumuman resmi</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition" />
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
