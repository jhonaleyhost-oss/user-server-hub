import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import {
  notificationsSupported,
  requestNotificationPermission,
  ensureNotificationSW,
  showAppNotification,
} from "@/lib/notify";

const PERMISSION_ASK_KEY = "chat-notif-asked";

/**
 * Globally listens to new chat + support messages and shows a browser/mobile
 * notification when the user is not actively viewing that conversation.
 */
const ChatNotifier = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
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
          if (m.user_id === user.id) return;

          const onChat = locationRef.current.startsWith("/chat");
          const focused = document.visibilityState === "visible" && document.hasFocus();
          if (onChat && focused) return;

          const p = await senderProfile(m.user_id);
          await showAppNotification(p.name || "Pesan baru", {
            body: m.image_url ? "📷 Mengirim foto" : m.content ?? "",
            icon: p.avatar,
            tag: "chat-message",
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
          // Regular users only care about replies in their own thread.
          if (!admin && m.thread_user_id !== user.id) return;
          // Ignore a regular user's own message. Admin test messages can use
          // the same account ID, so do not discard them before checking role.
          if (!admin && m.sender_user_id === user.id) return;
          // Admins only care about messages coming from users.
          if (admin && m.sender_role !== "user") return;

          let title = admin ? "Pesan support baru" : "Balasan dari Support";
          let icon: string | undefined;
          if (admin) {
            const p = await senderProfile(m.thread_user_id);
            if (p.name) title = `${p.name} • Support`;
            icon = p.avatar;
          }

          await showAppNotification(title, {
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
