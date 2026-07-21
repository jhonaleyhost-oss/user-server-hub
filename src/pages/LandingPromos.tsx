import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Tag, Copy, Clock, Sparkles, Crown, Megaphone, Loader2, ArrowRight, ArrowLeft, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import AccentColorPicker from "@/components/AccentColorPicker";
import { PageTransition } from "@/components/PageTransition";
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
  scope: "reseller" | "ads" | "adp" | "both";
  quota: number | null;
  used_count: number;
  expires_at: string | null;
}

const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");

const scopeMeta: Record<string, { label: string; icon: any; color: string }> = {
  reseller: { label: "Reseller", icon: Crown, color: "text-amber border-amber/30 bg-amber/10" },
  ads: { label: "Iklan", icon: Megaphone, color: "text-primary border-primary/30 bg-primary/10" },
  adp: { label: "Admin Panel", icon: Sparkles, color: "text-fuchsia-400 border-fuchsia-400/30 bg-fuchsia-400/10" },
  both: { label: "Reseller & Iklan", icon: Sparkles, color: "text-accent border-accent/30 bg-accent/10" },
};

const LandingPromos = () => {
  const [items, setItems] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("promo_codes")
        .select("id, code, description, banner_url, discount_type, discount_value, min_amount, max_discount, scope, quota, used_count, expires_at")
        .eq("active", true)
        .order("created_at", { ascending: false });
      setItems((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Kode ${code} disalin`);
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="sticky top-0 z-40 border-b border-border/50 backdrop-blur-xl bg-background/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
              <Logo size="md" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 mr-1">
                <AccentColorPicker />
                <ThemeToggle />
              </div>
              <Link to="/">
                <Button variant="ghost" size="sm" className="hidden sm:flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Beranda
                </Button>
              </Link>
              <Link to="/auth">
                <Button className="btn-primary flex items-center gap-2" size="sm">
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Masuk</span>
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <section className="relative overflow-hidden border-b border-border/50">
            <div className="absolute inset-0 -z-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-primary/15 blur-3xl opacity-40" />
            </div>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-4"
              >
                <Tag className="w-3.5 h-3.5" /> Promo Aktif
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-3xl sm:text-5xl font-extrabold tracking-tight"
              >
                Hemat Lebih Banyak
                <br />
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  dengan Kode Promo
                </span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-4 text-muted-foreground max-w-xl mx-auto"
              >
                Klaim kode promo di bawah dan gunakan saat pembelian Reseller, ADP, atau Iklan.
              </motion.p>
            </div>
          </section>

          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : items.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center max-w-md mx-auto">
                <Tag className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-muted-foreground">Belum ada promo aktif saat ini. Pantau terus halaman ini ya!</p>
                <Link to="/" className="inline-block mt-4">
                  <Button variant="outline" size="sm" className="gap-2">
                    <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((p, i) => {
                  const meta = scopeMeta[p.scope];
                  const Icon = meta.icon;
                  const remaining = p.quota ? Math.max(0, p.quota - p.used_count) : null;
                  const expired = p.expires_at && new Date(p.expires_at) <= new Date();
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <div className="glass-card rounded-2xl overflow-hidden group hover:border-primary/40 transition-all h-full flex flex-col">
                        {p.banner_url && (
                          <div className="relative w-full bg-secondary/30">
                            <img src={p.banner_url} alt={p.code} className="block w-full h-auto max-h-56 object-contain" />
                          </div>
                        )}
                        <div className="p-5 flex flex-col flex-1">
                          <div className="flex items-center justify-between mb-3 gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md border uppercase ${meta.color}`}>
                              <Icon className="w-3 h-3" /> {meta.label}
                            </span>
                            {remaining !== null && remaining <= 10 && (
                              <span className="text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/30 px-2 py-1 rounded-md">
                                Sisa {remaining}
                              </span>
                            )}
                          </div>
                          <p className="text-3xl font-bold text-foreground">
                            {p.discount_type === "percent" ? `${p.discount_value}%` : fmt(p.discount_value)}
                            <span className="text-sm font-normal text-muted-foreground ml-1">OFF</span>
                          </p>
                          {p.description && (
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                              <RichText text={p.description} />
                            </p>
                          )}
                          <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-secondary/40 border border-dashed border-primary/40">
                            <span className="font-mono text-base font-bold text-primary tracking-wider flex-1 truncate">{p.code}</span>
                            <button
                              onClick={() => copy(p.code)}
                              disabled={!!expired}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md bg-secondary hover:bg-secondary/80 disabled:opacity-50"
                            >
                              <Copy className="w-3 h-3" /> Salin
                            </button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            {p.min_amount > 0 && <span>Min belanja: <b className="text-foreground">{fmt(p.min_amount)}</b></span>}
                            {p.max_discount && p.discount_type === "percent" && (
                              <span>Maks diskon: <b className="text-foreground">{fmt(p.max_discount)}</b></span>
                            )}
                            {p.expires_at && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {expired ? "Berakhir" : `s/d ${new Date(p.expires_at).toLocaleDateString("id-ID")}`}
                              </span>
                            )}
                          </div>
                          <Link to="/auth" className="mt-4 block mt-auto pt-4">
                            <Button className="w-full btn-primary flex items-center justify-center gap-2" disabled={!!expired}>
                              Klaim Promo Sekarang
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="border-t border-border/50 py-16">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
              <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
              <h2 className="text-2xl sm:text-3xl font-bold">Belum punya akun?</h2>
              <p className="text-muted-foreground mt-2">Daftar gratis dan langsung pakai kode promo di atas.</p>
              <Link to="/auth" className="inline-block mt-6">
                <Button className="btn-primary h-12 px-8 gap-2">
                  <LogIn className="w-4 h-4" /> Daftar / Masuk
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </section>
        </main>

        <footer className="py-8 border-t border-border/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Logo size="sm" />
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Jhonaley Store · All rights reserved.</p>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
};

export default LandingPromos;