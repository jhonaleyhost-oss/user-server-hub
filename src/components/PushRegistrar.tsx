import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { subscribeToPush, webPushSupported } from "@/lib/webPush";

/** Keeps the current device subscribed to web push while a user is signed in. */
const PushRegistrar = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !webPushSupported()) return;
    if (Notification.permission !== "granted") return;
    const t = setTimeout(() => { void subscribeToPush(); }, 1500);
    return () => clearTimeout(t);
  }, [user]);

  return null;
};

export default PushRegistrar;
