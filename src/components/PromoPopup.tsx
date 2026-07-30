import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Sparkles, Megaphone, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';

interface PopupButton { label: string; url: string }

interface PopupData {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  buttons: PopupButton[];
  // ad metadata
  isAd?: boolean;
  ownerName?: string;
}

// Get next 7AM WIB timestamp (in user local time we use 07:00 local; close enough)
const nextSevenAm = () => {
  const now = new Date();
  const target = new Date(now);
  target.setHours(7, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target.getTime();
};

const PromoPopup = () => {
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const { isReseller, isAdmin, loading: roleLoading } = useUserRole();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canHide = isReseller || isAdmin;

  // Version the preference key so stale dismissals from the previous popup
  // behaviour cannot silently hide active promos after refresh/navigation.
  const hiddenKey = (id: string) => `promo_hidden_v2_until_${id}`;
  const isAdminPage = location.pathname.startsWith('/admin');

  useEffect(() => {
    setDontShow(false);
    setPopup(null);
    if (isAdminPage) {
      setOpen(false);
      return;
    }
    const fetchAll = async () => {
      const candidates: PopupData[] = [];

      // 1) Admin promo popup
      const { data: promo } = await supabase
        .from('popup_settings')
        .select('id, title, content, image_url, buttons')
        .eq('is_active', true)
        .eq('kind', 'promo')
        .limit(1)
        .maybeSingle();
      if (promo) {
        candidates.push({
          ...promo,
          buttons: Array.isArray(promo.buttons) ? (promo.buttons as unknown as PopupButton[]) : [],
        });
      }

      // 2) Active rented ads
      // Skip user-rented ads on public landing page (only admin promo shown there)
      const isLandingPublic = location.pathname === '/';
      const { data: ads } = isLandingPublic
        ? { data: [] as any[] }
        : await supabase.rpc('get_active_ads');
      if (Array.isArray(ads)) {
        for (const a of ads as any[]) {
          if (!a.content) continue;
          candidates.push({
            id: a.id,
            title: a.title,
            content: a.content,
            image_url: a.image_url,
            buttons: Array.isArray(a.buttons) ? a.buttons : [],
            isAd: true,
            ownerName: a.owner_name || 'Pengiklan',
          });
        }
      }

      // Filter dismissed
      const now = Date.now();
      const available = candidates.filter((p) => {
        // Regular users cannot opt out, so old browser preferences must never
        // prevent an active promo/ad from appearing for them.
        if (!canHide) return true;
        try {
          const hideUntil = localStorage.getItem(hiddenKey(p.id));
          if (hideUntil && parseInt(hideUntil, 10) > now) return false;
        } catch {}
        return true;
      });
      if (available.length === 0) return;

      // Random rotation
      const pick = available[Math.floor(Math.random() * available.length)];
      setPopup(pick);
      setOpen(true);
    };

    if (roleLoading) return;
    const timer = setTimeout(fetchAll, 600);
    return () => clearTimeout(timer);
  }, [roleLoading, user?.id, location.pathname, isAdminPage, canHide]);

  const handleClose = () => {
    if (popup) {
      try {
        // Reseller "hide until 7AM tomorrow"
        if (canHide && dontShow) {
          localStorage.setItem(hiddenKey(popup.id), String(nextSevenAm()));
        }
      } catch {}
    }
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-3 bg-black/85"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden border border-primary/20 shadow-[0_0_60px_-10px_hsl(var(--primary)/0.3)] max-h-[90vh] flex flex-col will-change-transform"
            style={{
              background: 'linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle (mobile) */}
            <div className="flex justify-center pt-2 pb-0 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Ad label */}
            {popup.isAd && (
              <div className="px-4 sm:px-5 pt-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber/15 text-amber border border-amber/30">
                  <Megaphone className="w-3 h-3" /> Iklan
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  oleh <span className="font-semibold text-foreground">{popup.ownerName}</span>
                </span>
              </div>
            )}

            {/* Header with glow */}
            <div className="relative p-4 pb-2 sm:p-5 sm:pb-3 shrink-0">
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse at top center, hsl(var(--primary)) 0%, transparent 70%)',
                }}
              />
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-primary/15 border border-primary/20">
                    {popup.isAd ? (
                      <Megaphone className="w-5 h-5 text-primary" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-primary" />
                    )}
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

            {/* Content - scrollable (image scrolls along) */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-3 text-[13px] space-y-0.5">
              {popup.image_url && (
                <button
                  type="button"
                  onClick={() => setLightbox(popup.image_url!)}
                  className="block w-full cursor-zoom-in mb-3"
                  title="Klik untuk lihat gambar full"
                >
                  <img
                    src={popup.image_url}
                    alt={popup.title || 'Promo'}
                    className="w-full rounded-xl object-cover max-h-44 border border-border/30 transition-transform hover:scale-[1.01]"
                  />
                </button>
              )}
              {renderContent(popup.content)}
            </div>

            {/* Buttons */}
            {popup.buttons.length > 0 && (
              <div className="px-4 sm:px-5 pb-2 pt-1 flex flex-wrap gap-2 shrink-0 justify-center">
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
            <div className="p-4 pt-2 shrink-0">
              {popup.isAd && !canHide && (
                <button
                  onClick={() => { handleClose(); navigate('/upgrade'); }}
                  className="w-full mb-2 text-[11px] text-muted-foreground hover:text-amber transition-colors flex items-center justify-center gap-1.5"
                >
                  <Crown className="w-3 h-3" /> Jadi Reseller untuk hilangkan iklan
                </button>
              )}
              {canHide && (
                <label className="flex items-center gap-2 mb-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Checkbox
                    checked={dontShow}
                    onCheckedChange={(v) => setDontShow(v === true)}
                  />
                  <span>Jangan tampilkan lagi (muncul lagi besok 07:00)</span>
                </label>
              )}
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
      {lightbox && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-secondary/80 hover:bg-secondary flex items-center justify-center"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox}
            alt="Iklan full"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PromoPopup;
