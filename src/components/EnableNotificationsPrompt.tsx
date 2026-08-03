import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { enablePushNotifications, hasPushSubscription, webPushSupported } from "@/lib/webPush";
import { toast } from "sonner";

const SNOOZE_KEY = "notif-prompt-snooze-until";

/** In-app banner asking signed-in users to allow notifications.
 *  Needed because a device that never granted permission can't receive push. */
const EnableNotificationsPrompt = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !webPushSupported()) return;
    const snoozed = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
    if (Date.now() < snoozed) return;
    if (Notification.permission === "denied") return;

    const t = setTimeout(async () => {
      const subscribed = await hasPushSubscription();
      if (!subscribed) setShow(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [user]);

  const snooze = (hours: number) => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + hours * 3600_000));
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[60] w-[min(94vw,26rem)] -translate-x-1/2 rounded-2xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md">
      <button
        aria-label="Tutup"
        onClick={() => snooze(24)}
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Aktifkan notifikasi</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dapatkan pemberitahuan promo, balasan support, dan pesan chat langsung di HP — walau situs ditutup.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="h-9 flex-1"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const ok = await enablePushNotifications();
                setBusy(false);
                if (ok) {
                  toast.success("Notifikasi aktif di perangkat ini");
                  setShow(false);
                } else {
                  toast.error("Gagal mengaktifkan notifikasi");
                  snooze(24);
                }
              }}
            >
              {busy ? "Memproses..." : "Izinkan sekarang"}
            </Button>
            <Button size="sm" variant="ghost" className="h-9" onClick={() => snooze(24)}>
              Nanti
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnableNotificationsPrompt;
