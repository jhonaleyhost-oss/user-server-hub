import { supabase } from "@/integrations/supabase/client";
import { ensureNotificationSW } from "@/lib/notify";

export const VAPID_PUBLIC_KEY =
  "BNSzL6KdHOxZmo7Hr5SKaCWgadvTiFD8Dh3_i5hh6LDV5IIXvVRBciXjcpMUGwaAXTiBBVjx6Cu0OE4c0L79Rz8";

export function webPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Subscribe this device to web push and store it for the logged-in user. */
export async function subscribeToPush(): Promise<boolean> {
  if (!webPushSupported()) return false;
  if (Notification.permission !== "granted") return false;

  const reg = await ensureNotificationSW();
  if (!reg) return false;

  try {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return false;

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: uid,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent.slice(0, 300),
      },
      { onConflict: "endpoint" }
    );
    return !error;
  } catch {
    return false;
  }
}

/** Ask permission (if needed) then subscribe. */
export async function enablePushNotifications(): Promise<boolean> {
  if (!webPushSupported()) return false;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      return false;
    }
  }
  return subscribeToPush();
}

/** True when THIS device already has an active push subscription.
 *  Used to avoid showing a duplicate local notification on top of the push. */
export async function hasPushSubscription(): Promise<boolean> {
  if (!webPushSupported()) return false;
  if (Notification.permission !== "granted") return false;
  try {
    const reg = await ensureNotificationSW();
    if (!reg) return false;
    return !!(await reg.pushManager.getSubscription());
  } catch {
    return false;
  }
}
