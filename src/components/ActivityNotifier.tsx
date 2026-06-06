import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Server, MessageCircle, Star, ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ProfileLite = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

/**
 * Globally listens for new panels, chat messages, and feedback,
 * and shows a small in-app toast notification (top-right).
 */
const ActivityNotifier = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const locationRef = useRef(location.pathname);
  const profilesRef = useRef<Record<string, ProfileLite>>({});
  const readyRef = useRef(false);

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  const loadProfiles = async () => {
    const { data } = await supabase.rpc("get_public_users");
    if (!data) return;
    const map: Record<string, ProfileLite> = {};
    for (const p of data as ProfileLite[]) map[p.user_id] = p;
    profilesRef.current = map;
  };

  const nameOf = async (uid: string) => {
    let p = profilesRef.current[uid];
    if (!p) {
      await loadProfiles();
      p = profilesRef.current[uid];
    }
    return p?.full_name?.trim() || "Seseorang";
  };

  useEffect(() => {
    if (!user) return;
    readyRef.current = false;
    loadProfiles();

    // Skip events fired during initial backfill / first 1.5s
    const readyT = setTimeout(() => {
      readyRef.current = true;
    }, 1500);

    const channel = supabase
      .channel("activity-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events", filter: "kind=eq.panel" },
        async (payload) => {
          if (!readyRef.current) return;
          const row = payload.new as {
            actor_user_id: string;
            actor_name: string | null;
            detail: string | null;
          };
          if (row.actor_user_id === user.id) return;
          const name = row.actor_name?.trim() || (await nameOf(row.actor_user_id));
          const [uname, ptypeRaw] = (row.detail || "").split("|");
          const ptype = (ptypeRaw || "").toLowerCase();
          const typeLabel = ptype === "python" ? "Python" : ptype === "nodejs" ? "NodeJS" : null;
          const desc = uname
            ? `Username: ${uname}${typeLabel ? ` • ${typeLabel}` : ""}`
            : undefined;
          toast(`${name} membuat panel baru`, {
            description: desc,
            icon: <Server className="w-4 h-4 text-primary" />,
            duration: 4000,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events", filter: "kind=eq.admin_cleanup" },
        async (payload) => {
          if (!readyRef.current) return;
          const row = payload.new as {
            actor_user_id: string | null;
            actor_name: string | null;
            detail: string | null;
            amount: number | null;
          };
          const name = row.actor_name?.trim() || (row.actor_user_id ? await nameOf(row.actor_user_id) : "Admin");
          const [countStr, serverName] = (row.detail || "").split("|");
          const count = row.amount ?? (parseInt(countStr || "0", 10) || 0);
          toast(`${name} membersihkan panel offline`, {
            description: `${count} panel dihapus${serverName ? ` • ${serverName}` : ""}`,
            icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
            duration: 5000,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          if (!readyRef.current) return;
          const row = payload.new as {
            user_id: string;
            content: string | null;
            image_url: string | null;
          };
          if (row.user_id === user.id) return;
          // Don't double-notify when user is actively on chat page
          if (locationRef.current.startsWith("/chat")) return;
          const name = await nameOf(row.user_id);
          const preview = row.image_url
            ? "📷 Mengirim foto"
            : (row.content || "").slice(0, 80);
          toast(`${name} mengirim pesan`, {
            description: preview || undefined,
            icon: <MessageCircle className="w-4 h-4 text-primary" />,
            duration: 4000,
            action: {
              label: "Buka",
              onClick: () => navigate("/chat"),
            },
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback" },
        async (payload) => {
          if (!readyRef.current) return;
          const row = payload.new as {
            user_id: string;
            username: string | null;
            rating: number;
            message: string | null;
          };
          if (row.user_id === user.id) return;
          const name = row.username?.trim() || (await nameOf(row.user_id));
          const stars = "★".repeat(Math.max(0, Math.min(5, row.rating)));
          toast(`${name} memberi feedback`, {
            description: `${stars}${row.message ? ` — ${row.message.slice(0, 80)}` : ""}`,
            icon: <Star className="w-4 h-4 text-amber-400" />,
            duration: 5000,
          });
        }
      )
      .subscribe();

    return () => {
      clearTimeout(readyT);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return null;
};

export default ActivityNotifier;