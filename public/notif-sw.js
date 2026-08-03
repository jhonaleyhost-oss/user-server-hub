// Notification-only service worker (no caching, no fetch handler).
// Required because mobile browsers block `new Notification()` and only allow
// notifications shown through a service worker registration.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(url); } catch { /* ignore */ }
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })()
  );
});

// ---- Web Push (works even when the site is closed) ----
self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { title: "Notifikasi", body: event.data ? event.data.text() : "" }; }
  const title = payload.title || "Notifikasi";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/favicon-64x64.png",
    image: payload.image || undefined,
    tag: payload.tag || "broadcast",
    renotify: true,
    vibrate: [80, 40, 80],
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
