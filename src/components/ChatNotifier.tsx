import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import {
  notificationsSupported,
  requestNotificationPermission,
  ensureNotificationSW,
  showAppNotification,
} from "@/lib/notify";
import { hasPushSubscription } from "@/lib/webPush";

const PERMISSION_ASK_KEY = "chat-notif-asked";

/** Show a local notification only when web push will NOT deliver one,
 *  otherwise the user receives the same alert twice. */
const showIfNoPush = async (
  title: string,
  opts: Parameters<typeof showAppNotification>[1]
) => {
  if (await hasPushSubscription()) return;
  await showAppNotification(title, opts);
};

/** Send a targeted/broadcast push via the send-push edge function. */
const sendPush = async (payload: {
  title: string;
  body: string;
  url?: string;
  image?: string;
  target_user_id?: string;
  exclude_user_id?: string;
  role?: string;
  tag?: string;
}) => {
  try {
    // Guard: the same user may have several tabs open — each one receives the
    // realtime INSERT and would fire an identical push. Only the first wins.
    if (payload.tag) {
      const key = `push-sent-${payload.tag}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
      // keep storage tidy
      const stamps = Object.keys(localStorage).filter((k) => k.startsWith("push-sent-"));
      if (stamps.length > 100) stamps.slice(0, 50).forEach((k) => localStorage.removeItem(k));
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
  } catch {
    /* ignore: push is best-effort */
  }
};

/**
 * Globally listens to new chat + support messages and shows a browser/mobile
 * notification when the user is not actively viewing that conversation.
 * Also triggers Web Push to recipients so the popup appears even when the site
 * is closed.
 */
const ChatNotifier = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  const isAdminRef = useRef(isAdmin);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  // Ask for permission once when user is logged in, and make sure the
  // notification service worker is registered (required on mobile).
  useEffect(() => {
    if (!user) return;
    if (!notificationsSupported()) return;

    if (Notification.permission === "granted") {
      ensureNotificationSW();
      return;
    }
    if (Notification.permission !== "default") return;
    if (sessionStorage.getItem(PERMISSION_ASK_KEY)) return;

    const t = setTimeout(() => {
      sessionStorage.setItem(PERMISSION_ASK_KEY, "1");
      requestNotificationPermission();
    }, 2500);
    return () => clearTimeout(t);
  }, [user]);

  // Subscribe to new chat + support messages globally
  useEffect(() => {
    if (!user) return;

    const senderProfile = async (uid: string | null) => {
      if (!uid) return { name: null as string | null, avatar: undefined as string | undefined };
      try {
        const { data } = await supabase.rpc("get_public_users");
        const list = (data ?? []) as Array<{
          user_id: string;
          full_name: string | null;
          avatar_url: string | null;
        }>;
        const p = list.find((u) => u.user_id === uid);
        return { name: p?.full_name ?? null, avatar: p?.avatar_url ?? undefined };
      } catch {
        return { name: null, avatar: undefined };
      }
    };

    const channel = supabase
      .channel("chat-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const m = payload.new as {
            id: string;
            user_id: string;
            content: string | null;
            image_url: string | null;
          };

          // If this is the current user's own message, trigger a push to
          // everyone else so offline users still get a popup.
          if (m.user_id === user.id) {
            const p = await senderProfile(m.user_id);
            await sendPush({
              title: p.name ? `${p.name} • Chat` : "Pesan baru di Chat",
              body: m.image_url ? "📷 Mengirim foto" : m.content ?? "",
              url: "/chat",
              exclude_user_id: user.id,
              tag: `chat-${m.id}`,
            });
            return;
          }

          const onChat = locationRef.current.startsWith("/chat");
          const focused = document.visibilityState === "visible" && document.hasFocus();
          if (onChat && focused) return;
          // Respect the per-device "mute chat notifications" toggle in /chat
          if (localStorage.getItem("chat:notif-muted") === "1") return;

          const p = await senderProfile(m.user_id);
          await showIfNoPush(p.name || "Pesan baru", {
            body: m.image_url ? "📷 Mengirim foto" : m.content ?? "",
            icon: p.avatar,
            tag: `chat-${m.id}`,
            url: "/chat",
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        async (payload) => {
          const m = payload.new as {
            id: string;
            sender_role: string;
            sender_user_id: string | null;
            thread_user_id: string;
            content: string | null;
            image_url: string | null;
          };
          const admin = isAdminRef.current;

          // If the current user sent this support message, trigger a push to
          // the recipient so they get a popup even when the site is closed.
          if (m.sender_user_id === user.id) {
            const p = await senderProfile(user.id);
            if (admin) {
              await sendPush({
                title: "Balasan dari Support",
                body: m.image_url ? "📷 Mengirim foto" : m.content ?? "",
                url: "/dashboard",
                target_user_id: m.thread_user_id,
                tag: `support-${m.id}`,
              });
            } else {
              await sendPush({
                title: p.name ? `${p.name} • Support` : "Pesan support baru",
                body: m.image_url ? "📷 Mengirim foto" : m.content ?? "",
                url: "/support",
                role: "admin",
                tag: `support-${m.id}`,
              });
            }
            return;
          }

          // Regular users only care about replies in their own thread.
          if (!admin && m.thread_user_id !== user.id) return;
          // Admins only care about messages coming from users.
          if (admin && m.sender_role !== "user") return;

          let title = admin ? "Pesan support baru" : "Balasan dari Support";
          let icon: string | undefined;
          if (admin) {
            const p = await senderProfile(m.thread_user_id);
            if (p.name) title = `${p.name} • Support`;
            icon = p.avatar;
          }

          await showIfNoPush(title, {
            body: m.image_url ? "📷 Mengirim foto" : m.content ?? "",
            icon,
            tag: `support-${m.id}`,
            url: admin ? "/support" : "/dashboard",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return null;
};

export default ChatNotifier;
