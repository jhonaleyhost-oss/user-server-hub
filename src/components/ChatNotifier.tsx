import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const PERMISSION_ASK_KEY = "chat-notif-asked";

/**
 * Globally listens to new chat messages and shows a browser notification
 * when the user is not currently focused on the /chat page.
 */
const ChatNotifier = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  // Ask for permission once when user is logged in
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (sessionStorage.getItem(PERMISSION_ASK_KEY)) return;

    const t = setTimeout(() => {
      sessionStorage.setItem(PERMISSION_ASK_KEY, "1");
      Notification.requestPermission().catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [user]);

  // Subscribe to new chat messages globally
  useEffect(() => {
    if (!user) return;

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

          if (!("Notification" in window) || Notification.permission !== "granted") return;

          // Try fetch sender profile for nicer notification
          let title = "Pesan baru";
          let icon: string | undefined;
          try {
            const { data } = await supabase.rpc("get_public_users", {
              p_user_ids: [m.user_id],
            });
            const p = Array.isArray(data) ? (data as Array<{ full_name: string | null; avatar_url: string | null }>)[0] : null;
            if (p?.full_name) title = p.full_name;
            if (p?.avatar_url) icon = p.avatar_url;
          } catch {
            // ignore
          }

          const body = m.image_url ? "📷 Mengirim foto" : (m.content ?? "");
          try {
            const n = new Notification(title, {
              body,
              icon: icon ?? "/favicon.ico",
              tag: "chat-message",
              badge: "/favicon.ico",
            });
            n.onclick = () => {
              window.focus();
              navigate("/chat");
              n.close();
            };
          } catch {
            // ignore
          }
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