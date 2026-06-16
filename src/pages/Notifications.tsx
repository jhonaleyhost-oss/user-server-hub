import { Bell, CheckCheck, ExternalLink, Megaphone, Loader2 } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import AppShell from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import { useNotifications } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export default function Notifications() {
  const { items, unread, loading, markAllRead, markOneRead } = useNotifications();
  const navigate = useNavigate();

  return (
    <AppShell>
      <PageTransition>
        <div className="container max-w-3xl mx-auto px-4 py-6 space-y-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <GlassCard className="p-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ background: "radial-gradient(ellipse at top right, hsl(var(--primary)) 0%, transparent 70%)" }} />
              <div className="relative flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/15 border border-primary/30 shrink-0">
                  <Megaphone className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold">Notifikasi & Pengumuman</h1>
                  <p className="text-sm text-muted-foreground mt-1">Semua pengumuman resmi dari admin Jhonaley Store.</p>
                </div>
                {unread > 0 && (
                  <Button onClick={markAllRead} variant="outline" size="sm" className="gap-1.5 shrink-0">
                    <CheckCheck className="w-3.5 h-3.5" /> Tandai semua dibaca
                  </Button>
                )}
              </div>
            </GlassCard>
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">Belum ada notifikasi</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {items.map((n) => (
                <motion.div key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <GlassCard className={`p-5 transition-all ${!n.is_read ? "border-primary/50 bg-primary/[0.03]" : ""}`}>
                    <div className="flex items-start gap-3">
                      {!n.is_read && <span className="mt-2 w-2.5 h-2.5 rounded-full bg-primary shrink-0 animate-pulse" />}
                      <div className="flex-1 min-w-0">
                        {n.banner_url && (
                          <img src={n.banner_url} alt="" className="w-full max-h-48 object-cover rounded-lg mb-3 border border-border" />
                        )}
                        <h3 className="text-base font-bold text-foreground mb-1">{n.title}</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{n.body}</p>
                        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: idLocale })}
                          </span>
                          <div className="flex items-center gap-2">
                            {n.link_url && (
                              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => {
                                if (!n.is_read) markOneRead(n.id);
                                if (n.link_url!.startsWith("http")) window.open(n.link_url!, "_blank");
                                else navigate(n.link_url!);
                              }}>
                                Buka <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                            {!n.is_read && (
                              <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => markOneRead(n.id)}>
                                <CheckCheck className="w-3 h-3" /> Tandai dibaca
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </PageTransition>
    </AppShell>
  );
}