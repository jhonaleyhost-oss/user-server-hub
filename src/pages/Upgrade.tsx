import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Send, ExternalLink, Check, ShieldCheck, Zap, Code } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import GlassCard from '@/components/GlassCard';
import AppShell from '@/components/AppShell';
import { PageTransition } from '@/components/PageTransition';

interface PopupButton {
  label: string;
  url: string;
}

interface PopupData {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  buttons: PopupButton[];
}

const renderContent = (text: string) => {
  return text.split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (trimmed === '') return <div key={i} className="h-2" />;

    const parts = line.split(/\*\*(.*?)\*\*/g);
    const isTreeItem = /^[├└│]/.test(trimmed);
    const isNumbered = /^[1-5]️⃣/.test(trimmed);

    return (
      <p
        key={i}
        className={`leading-relaxed ${
          isTreeItem
            ? 'text-foreground/90 pl-1 font-mono text-[13px]'
            : isNumbered
            ? 'text-foreground/90 pl-1'
            : 'text-foreground/80'
        }`}
      >
        {parts.map((part, j) =>
          j % 2 === 1 ? (
            <span key={j} className="font-bold text-primary">
              {part}
            </span>
          ) : (
            <span key={j}>{part}</span>
          )
        )}
      </p>
    );
  });
};

const Upgrade = () => {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPopup = async () => {
      const { data } = await supabase
        .from('popup_settings')
        .select('id, title, content, image_url, buttons')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (data) {
        const buttons = Array.isArray(data.buttons)
          ? (data.buttons as unknown as PopupButton[])
          : [];
        setPopup({ ...data, buttons });
      }
      setLoading(false);
    };
    fetchPopup();
  }, []);

  return (
    <PageTransition>
      <AppShell>
        <div className="min-h-screen py-8 px-4 bg-background">
          <div className="w-full max-w-2xl mx-auto relative z-10">
            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber via-primary to-accent mb-4 shadow-lg shadow-primary/30">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
                Upgrade ke <span className="text-amber">Premium</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Buka semua fitur eksklusif dan akses tanpa batas.
              </p>
            </motion.div>

            {/* Promo Content from DB */}
            {loading ? (
              <GlassCard className="p-8 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-muted-foreground mt-4 text-sm">Memuat promo...</p>
              </GlassCard>
            ) : popup ? (
              <GlassCard className="overflow-hidden mb-6" animate={false}>
                <div className="relative p-5">
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(ellipse at top center, hsl(var(--primary)) 0%, transparent 70%)',
                    }}
                  />
                  <div className="relative flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/15 border border-primary/20">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground leading-tight">
                      {popup.title}
                    </h2>
                  </div>
                </div>

                {popup.image_url && (
                  <div className="px-5">
                    <img
                      src={popup.image_url}
                      alt="Promo"
                      className="w-full rounded-xl object-cover max-h-60 border border-border/30"
                    />
                  </div>
                )}

                <div className="px-5 py-4 text-sm space-y-0.5">
                  {renderContent(popup.content)}
                </div>

                {popup.buttons.length > 0 && (
                  <div className="px-5 pb-5 flex flex-wrap gap-2 justify-center">
                    {popup.buttons.map((btn, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                        onClick={() => window.open(btn.url, '_blank')}
                      >
                        {btn.label}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </Button>
                    ))}
                  </div>
                )}
              </GlassCard>
            ) : null}

            {/* Benefits Grid */}
            <GlassCard className="p-6 mb-6">
              <h3 className="font-bold text-foreground mb-4 text-center">Yang Kamu Dapatkan</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald shrink-0" /> Unlimited RAM & CPU
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald shrink-0" /> Buat Panel Tanpa Batas
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald shrink-0" /> Akses 2 Tipe Panel
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Check className="w-4 h-4 text-emerald shrink-0" /> Akses Permanen
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald shrink-0" /> Anti-Intip & Aman 100%
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Zap className="w-4 h-4 text-emerald shrink-0" /> Server Private RAM 32 / Core 16
                </div>
                <div className="flex items-center gap-2 text-muted-foreground sm:col-span-2">
                  <Code className="w-4 h-4 text-emerald shrink-0" /> Support Python & Node.js
                </div>
              </div>
            </GlassCard>

            {/* Price + CTA */}
            <GlassCard className="p-6 text-center" delay={0.2}>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Harga Spesial
              </p>
              <p className="text-4xl font-bold text-amber mb-1">
                Rp 35.000
                <span className="text-sm font-normal text-muted-foreground"> /lifetime</span>
              </p>
              <p className="text-xs text-muted-foreground mb-5">
                Bayar sekali, pakai selamanya.
              </p>
              <Button
                onClick={() => window.open('https://t.me/upgradeuser_bot', '_blank')}
                className="w-full bg-amber hover:bg-amber/90 text-background font-bold gap-2 h-12"
              >
                <Send className="w-4 h-4" />
                Upgrade Ke Reseller via Telegram
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Akan diarahkan ke @upgradeuser_bot
              </p>
            </GlassCard>
          </div>
        </div>
      </AppShell>
    </PageTransition>
  );
};

export default Upgrade;