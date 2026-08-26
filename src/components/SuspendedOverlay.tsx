import { useLocation, useNavigate } from "react-router-dom";
import { Ban, LifeBuoy, LogOut, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSuspension } from "@/hooks/useSuspension";
import { supabase } from "@/integrations/supabase/client";

/**
 * Full-screen non-dismissible overlay shown to suspended accounts.
 * On /support it shrinks to a slim banner so the user can still appeal.
 */
const SuspendedOverlay = () => {
  const status = useSuspension();
  const location = useLocation();
  const navigate = useNavigate();

  if (!status?.is_suspended) return null;

  const onSupportPage = location.pathname.startsWith("/support");

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      localStorage.clear();
      sessionStorage.clear();
      navigate("/", { replace: true });
    }
  };

  const suspendedAt = status.suspended_at
    ? new Date(status.suspended_at).toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Slim banner on the support page so the user can still appeal
  if (onSupportPage) {
    return (
      <div className="fixed top-0 inset-x-0 z-[100] bg-destructive/95 backdrop-blur border-b border-destructive-foreground/20 px-4 py-2.5 flex items-center justify-center gap-2 text-center">
        <Ban className="w-4 h-4 text-destructive-foreground shrink-0" />
        <p className="text-xs sm:text-sm font-medium text-destructive-foreground">
          Akun kamu sedang di-suspend. Halaman support tetap terbuka untuk pengajuan banding.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-xl p-4">
      <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 sm:p-8 text-center shadow-[0_0_60px_-15px_hsl(var(--destructive)/0.4)]">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 border border-destructive/30">
          <Ban className="h-10 w-10 text-destructive" strokeWidth={2.2} />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1">
          Akun Di-suspend
        </h1>
        <p className="text-sm text-muted-foreground mb-5">
          Akses layanan kamu dibatasi sementara oleh admin.
          {suspendedAt && (
            <span className="block mt-1 text-xs">Sejak {suspendedAt} WIB</span>
          )}
        </p>

        <div className="rounded-xl border border-border bg-secondary/40 p-4 mb-6 text-left">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Alasan Suspend
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
            {status.suspension_reason?.trim() || "Tidak ada alasan yang dicantumkan."}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <Button
            className="w-full h-11"
            onClick={() => navigate("/support")}
          >
            <LifeBuoy className="w-4 h-4 mr-2" />
            Ajukan Banding via Support
          </Button>
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={() => window.open("https://t.me/jhonaleystorecs", "_blank")}
          >
            <Send className="w-4 h-4 mr-2" />
            Hubungi CS Telegram
          </Button>
          <Button
            variant="ghost"
            className="w-full h-11 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Keluar Akun
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SuspendedOverlay;
