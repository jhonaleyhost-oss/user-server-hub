/**
 * Cross-platform web notifications.
 *
 * Mobile browsers (Android Chrome, installed PWAs) throw
 * "Illegal constructor" for `new Notification()` — notifications MUST be shown
 * through a service worker registration. This helper registers a tiny
 * notification-only service worker and uses it when available.
 */

const SW_URL = "/notif-sw.js";
let swRegistration: ServiceWorkerRegistration | null = null;
let registering: Promise<ServiceWorkerRegistration | null> | null = null;

export function notificationsSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function ensureNotificationSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (swRegistration) return swRegistration;
  if (registering) return registering;

  registering = navigator.serviceWorker
    .register(SW_URL, { scope: "/" })
    .then(async (reg) => {
      swRegistration = reg;
      try {
        await navigator.serviceWorker.ready;
      } catch {
        /* ignore */
      }
      return reg;
    })
    .catch(() => null)
    .finally(() => {
      registering = null;
    });

  return registering;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }
  if (permission === "granted") await ensureNotificationSW();
  return permission;
}

export interface ShowNotifOptions {
  body?: string;
  icon?: string;
  tag?: string;
  url?: string;
  renotify?: boolean;
}

export async function showAppNotification(title: string, opts: ShowNotifOptions = {}) {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;

  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[]; data?: unknown } = {
    body: opts.body,
    icon: opts.icon ?? "/icon-192.png",
    badge: "/favicon-64x64.png",
    tag: opts.tag,
    renotify: opts.renotify ?? true,
    vibrate: [80, 40, 80],
    data: { url: opts.url ?? "/" },
  };

  // Preferred path: service worker (works on desktop AND mobile)
  const reg = await ensureNotificationSW();
  if (reg) {
    try {
      await reg.showNotification(title, options);
      return true;
    } catch {
      /* fall through */
    }
  }

  // Fallback: classic Notification (desktop only)
  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      window.location.href = opts.url ?? "/";
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}
