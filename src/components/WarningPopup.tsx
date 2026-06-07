import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useUserRole } from '@/hooks/useUserRole';

interface PopupButton {
  label: string;
  url: string;
}

interface WarningData {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  buttons: PopupButton[];
  audience: 'all' | 'reseller';
}

const WarningPopup = () => {
  const [popup, setPopup] = useState<WarningData | null>(null);
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const { isReseller, isAdmin, loading: roleLoading } = useUserRole();
  const canHide = isReseller || isAdmin;

  const dismissedKey = (id: string) => `warning_popup_dismissed_${id}`;

  // Window key resets every day at 07:00 WIB (= 00:00 UTC).
  // We use the current UTC date (YYYY-MM-DD) as the window identifier.
  const currentWindowKey = () => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  useEffect(() => {
    if (roleLoading) return;
    const fetchPopup = async () => {
      const { data } = await supabase
        .from('popup_settings')
        .select('id, title, content, image_url, buttons, audience')
        .eq('is_active', true)
        .eq('kind', 'warning')
        .limit(1)
        .maybeSingle();

      if (!data) return;
      const audience = (data as any).audience === 'reseller' ? 'reseller' : 'all';
      // Audience filter
      if (audience === 'reseller' && !(isReseller || isAdmin)) return;

      try {
        // Suppress only within the same daily window (resets 07:00 WIB).
        if (localStorage.getItem(dismissedKey(data.id)) === currentWindowKey()) return;
      } catch {}

      const buttons = Array.isArray(data.buttons)
        ? (data.buttons as unknown as PopupButton[])
        : [];
      setPopup({
        id: data.id,
        title: data.title,
        content: data.content,
        image_url: data.image_url,
        buttons,
        audience,
      });
      setOpen(true);
    };

    const timer = setTimeout(fetchPopup, 700);
    return () => clearTimeout(timer);
  }, [roleLoading, isReseller, isAdmin]);

  const handleClose = () => {
    if (canHide && dontShow && popup) {
      try {
        localStorage.setItem(dismissedKey(popup.id), currentWindowKey());
      } catch {}
    }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const renderContent = (text: string) => {
    return text.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (trimmed === '') return <div key={i} className="h-2" />;
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} className="leading-relaxed text-foreground/85 text-[13px]">
          {parts.map((part, j) =>
            j % 2 === 1 ? (
              <span key={j} className="font-bold text-amber-400">{part}</span>
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
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-3 bg-black/85"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden border border-amber-500/30 shadow-[0_0_60px_-10px_rgba(245,158,11,0.45)] max-h-[90vh] flex flex-col will-change-transform"
            style={{
              background:
                'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 pb-0 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            <div className="relative p-4 pb-2 sm:p-5 sm:pb-3 shrink-0">
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at top center, rgba(245,158,11,1) 0%, transparent 70%)',
                }}
              />
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground leading-tight">
                      {popup.title}
                    </h2>
                    <p className="text-[10px] uppercase tracking-wider text-amber-400/80 mt-0.5">
                      {popup.audience === 'reseller' ? 'Khusus Reseller' : 'Pengumuman'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-full bg-secondary/80 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {popup.image_url && (
              <div className="px-4 shrink-0">
                <img
                  src={popup.image_url}
                  alt="Warning"
                  className="w-full rounded-xl object-cover max-h-44 border border-border/30"
                />
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3 space-y-0.5">
              {renderContent(popup.content)}
            </div>

            {popup.buttons.length > 0 && (
              <div className="px-4 sm:px-5 pb-2 pt-1 flex flex-wrap gap-2 shrink-0 justify-center">
                {popup.buttons.map((btn, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs border-amber-500/30 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all"
                    onClick={() => window.open(btn.url, '_blank')}
                  >
                    {btn.label}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </Button>
                ))}
              </div>
            )}

            <div className="p-4 pt-2 shrink-0">
              {canHide && (
                <label className="flex items-center gap-2 mb-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Checkbox
                    checked={dontShow}
                    onCheckedChange={(v) => setDontShow(v === true)}
                  />
                  <span>Jangan tampilkan lagi</span>
                </label>
              )}
              <Button
                onClick={handleClose}
                className="w-full font-semibold shadow-lg shadow-amber-500/20 bg-amber-500 hover:bg-amber-600 text-black"
                size="sm"
              >
                Saya Mengerti
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WarningPopup;