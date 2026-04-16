import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
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

const SESSION_KEY = 'promo_popup_shown';

const PromoPopup = () => {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;

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

    fetchPopup();
  }, []);

  const handleClose = () => {
    setOpen(false);
    sessionStorage.setItem(SESSION_KEY, '1');
  };

  const renderContent = (text: string) => {
    // Simple markdown-like bold rendering
    return text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} className={line.trim() === '' ? 'h-3' : 'leading-relaxed'}>
          {parts.map((part, j) =>
            j % 2 === 1 ? (
              <span key={j} className="font-bold text-foreground">{part}</span>
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
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-primary/20 to-primary/5 p-4 border-b border-border/30">
              <h2 className="text-lg font-bold text-foreground pr-8">{popup.title}</h2>
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Image */}
            {popup.image_url && (
              <div className="px-4 pt-4">
                <img
                  src={popup.image_url}
                  alt="Promo"
                  className="w-full rounded-lg object-cover max-h-48"
                />
              </div>
            )}

            {/* Content */}
            <ScrollArea className="max-h-[50vh]">
              <div className="p-4 text-sm text-muted-foreground whitespace-pre-wrap space-y-0.5">
                {renderContent(popup.content)}
              </div>
            </ScrollArea>

            {/* Buttons */}
            {popup.buttons.length > 0 && (
              <div className="p-4 pt-0 flex flex-wrap gap-2">
                {popup.buttons.map((btn, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => window.open(btn.url, '_blank')}
                  >
                    {btn.label}
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                ))}
              </div>
            )}

            {/* Close button */}
            <div className="p-4 pt-2 border-t border-border/30">
              <Button onClick={handleClose} className="w-full btn-primary" size="sm">
                Tutup
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PromoPopup;
