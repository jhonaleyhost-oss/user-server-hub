import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Tag, Copy, Clock, Sparkles, Crown, Megaphone, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import GlassCard from "@/components/GlassCard";
import AppShell from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import { toast } from "sonner";
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
  expires_at: string | null;
}

const fmt = (n: number) => "Rp " + n.toLocaleString("id-ID");

const scopeMeta: Record<string, { label: string; icon: any; color: string }> = {
  reseller: { label: "Reseller", icon: Crown, color: "text-amber border-amber/30 bg-amber/10" },
  ads: { label: "Iklan", icon: Megaphone, color: "text-primary border-primary/30 bg-primary/10" },
  both: { label: "Reseller & Iklan", icon: Sparkles, color: "text-accent border-accent/30 bg-accent/10" },
};

export default function Promos() {
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
    <AppShell>
      <PageTransition>
        <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="p-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at top right, hsl(var(--primary)) 0%, transparent 70%)" }} />
              <div className="relative flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/15 border border-primary/30 shrink-0">
                  <Tag className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold">Promo & Kupon</h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Salin kode promo dan gunakan saat pembelian Reseller atau Iklan untuk dapat diskon.
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <Tag className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">Belum ada promo aktif saat ini. Pantau terus halaman ini ya!</p>
            </GlassCard>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {items.map((p) => {
                const meta = scopeMeta[p.scope];
                const Icon = meta.icon;
                const remaining = p.quota ? Math.max(0, p.quota - p.used_count) : null;
                const expired = p.expires_at && new Date(p.expires_at) <= new Date();
                return (
                  <motion.div key={p.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                    <GlassCard className="relative overflow-hidden group hover:border-primary/40 transition-all">
                      {p.banner_url && (
                        <div className="relative h-32 w-full">
                          <img src={p.banner_url} alt={p.code} className="absolute inset-0 w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
                        </div>
                      )}
                      <div className="p-5 relative">
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
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            <RichText text={p.description} />
                          </p>
                        )}
                        <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-secondary/40 border border-dashed border-primary/40">
                          <span className="font-mono text-base font-bold text-primary tracking-wider flex-1 truncate">{p.code}</span>
                          <button
                            onClick={() => copy(p.code)}
                            disabled={!!expired}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
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
                      </div>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </PageTransition>
    </AppShell>
  );
}