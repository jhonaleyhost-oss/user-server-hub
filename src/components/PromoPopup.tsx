import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

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

const PromoPopup = () => {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [open, setOpen] = useState(false);

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
        setOpen(true);
      }
    };

    // Small delay so the page loads first
    const timer = setTimeout(fetchPopup, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setOpen(false);
  };

  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (trimmed === '') return <div key={i} className="h-2" />;

      const parts = line.split(/\*\*(.*?)\*\*/g);

      // Detect section headers (lines starting with emoji + all caps or bold)
      const isHeader = /^[├└│🚀💎✨🎁📊💡🛒🌟🛠️⭐]/.test(trimmed) && parts.some((_, j) => j % 2 === 1);
      // Detect tree items
      const isTreeItem = /^[├└│]/.test(trimmed);
      // Detect numbered items
      const isNumbered = /^[1-5]️⃣/.test(trimmed);

      return (
        <p
          key={i}
          className={`leading-relaxed ${
            isHeader ? 'text-foreground font-semibold mt-1' :
            isTreeItem ? 'text-foreground/90 pl-1 font-mono text-[13px]' :
            isNumbered ? 'text-foreground/90 pl-1' :
            'text-foreground/80'
          }`}
        >
          {parts.map((part, j) =>
            j % 2 === 1 ? (
              <span key={j} className="font-bold text-primary">{part}</span>
            ) : (
              <span key={j}>{part}</span>
            )
          )}
        </p>
      );
    });
  };

  return (
    <AnimatePresence>
      {open && popup && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/80 backdrop-blur-md"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            className="w-full max-w-md rounded-2xl overflow-hidden border border-primary/20 shadow-[0_0_60px_-10px_hsl(var(--primary)/0.3)]"
            style={{
              background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with glow */}
            <div className="relative p-5 pb-3">
              {/* Glow accent */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at top center, hsl(var(--primary)) 0%, transparent 70%)',
                }}
              />
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/15 border border-primary/20">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-base font-bold text-foreground leading-tight">{popup.title}</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-full bg-secondary/80 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image */}
            {popup.image_url && (
              <div className="px-4">
                <img
                  src={popup.image_url}
                  alt="Promo"
                  className="w-full rounded-xl object-cover max-h-44 border border-border/30"
                />
              </div>
            )}

            {/* Content */}
            <ScrollArea className="max-h-[55vh]">
              <div className="px-5 py-3 text-[13px] space-y-0.5">
                {renderContent(popup.content)}
              </div>
            </ScrollArea>

            {/* Buttons */}
            {popup.buttons.length > 0 && (
              <div className="px-5 pb-2 flex flex-wrap gap-2">
                {popup.buttons.map((btn, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
                    onClick={() => window.open(btn.url, '_blank')}
                  >
                    {btn.label}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </Button>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="p-4 pt-3">
              <Button
                onClick={handleClose}
                className="w-full btn-primary font-semibold shadow-lg shadow-primary/20"
                size="sm"
              >
                Mengerti, Tutup
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PromoPopup;
