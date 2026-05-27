import { useEffect, useMemo, useRef, useState } from "react";
import { Server, MessageCircle, Star, Radio } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type ActivityKind = "panel" | "chat" | "feedback";

interface ActivityItem {
  id: string;
  kind: ActivityKind;
  text: string;
  detail?: string;
  created_at: string;
}

type ProfileLite = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
};

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "baru saja";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  const d = Math.floor(h / 24);
  return `${d}h lalu`;
};

const MAX_ITEMS = 20;

const ActivityTicker = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const profilesRef = useRef<Record<string, ProfileLite>>({});
  const [, setTick] = useState(0);

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

  const push = (item: ActivityItem) => {
    setItems((prev) => {
      if (prev.some((x) => x.id === item.id)) return prev;
      return [item, ...prev].slice(0, MAX_ITEMS);
    });
  };

  // Initial load: combine recent panels, messages, feedback
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      await loadProfiles();

      const [panelsRes, msgRes, fbRes] = await Promise.all([
        (supabase.rpc as any)("get_panel_activity", { _limit: 10 }),
        supabase
          .from("messages")
          .select("id, user_id, content, image_url, created_at, deleted")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("feedback")
          .select("id, user_id, username, rating, message, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (cancelled) return;

      const collected: ActivityItem[] = [];

      for (const p of (panelsRes.data ?? []) as Array<{
        id: string;
        full_name: string | null;
        username: string;
        created_at: string;
      }>) {
        collected.push({
          id: `panel-${p.id}`,
          kind: "panel",
          text: `${p.full_name?.trim() || "Seseorang"} membuat panel`,
          detail: p.username,
          created_at: p.created_at,
        });
      }

      for (const m of (msgRes.data ?? []) as Array<{
        id: string;
        user_id: string;
        content: string | null;
        image_url: string | null;
        created_at: string;
        deleted: boolean;
      }>) {
        if (m.deleted) continue;
        const name = profilesRef.current[m.user_id]?.full_name?.trim() || "Seseorang";
        const preview = m.image_url ? "📷 foto" : (m.content || "").slice(0, 60);
        collected.push({
          id: `chat-${m.id}`,
          kind: "chat",
          text: `${name} mengirim pesan`,
          detail: preview || undefined,
          created_at: m.created_at,
        });
      }

      for (const f of (fbRes.data ?? []) as Array<{
        id: string;
        user_id: string;
        username: string;
        rating: number;
        message: string | null;
        created_at: string;
      }>) {
        const name =
          f.username?.trim() ||
          profilesRef.current[f.user_id]?.full_name?.trim() ||
          "Seseorang";
        const stars = "★".repeat(Math.max(0, Math.min(5, f.rating)));
        collected.push({
          id: `fb-${f.id}`,
          kind: "feedback",
          text: `${name} memberi feedback ${stars}`,
          detail: f.message ? f.message.slice(0, 60) : undefined,
          created_at: f.created_at,
        });
      }

      collected.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setItems(collected.slice(0, MAX_ITEMS));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Realtime: panels, messages, feedback
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("activity-ticker")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_panels" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            username: string;
            created_at: string;
          };
          const name = await nameOf(row.user_id);
          push({
            id: `panel-${row.id}`,
            kind: "panel",
            text: `${name} membuat panel`,
            detail: row.username,
            created_at: row.created_at,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            content: string | null;
            image_url: string | null;
            created_at: string;
          };
          const name = await nameOf(row.user_id);
          const preview = row.image_url ? "📷 foto" : (row.content || "").slice(0, 60);
          push({
            id: `chat-${row.id}`,
            kind: "chat",
            text: `${name} mengirim pesan`,
            detail: preview || undefined,
            created_at: row.created_at,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feedback" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            user_id: string;
            username: string;
            rating: number;
            message: string | null;
            created_at: string;
          };
          const name = row.username?.trim() || (await nameOf(row.user_id));
          const stars = "★".repeat(Math.max(0, Math.min(5, row.rating)));
          push({
            id: `fb-${row.id}`,
            kind: "feedback",
            text: `${name} memberi feedback ${stars}`,
            detail: row.message ? row.message.slice(0, 60) : undefined,
            created_at: row.created_at,
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Refresh relative timestamps every 30s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Ensure ticker always has enough content to fill the loop — repeat items if too few
  const looped = useMemo(() => {
    if (items.length === 0) return [];
    let arr = items.slice();
    // Keep duplicating until we reach at least 6 items so the marquee loop feels continuous
    while (arr.length < 6) arr = arr.concat(items);
    return arr;
  }, [items]);

  // Animation duration based on item count for stable speed
  const duration = Math.max(50, Math.min(140, looped.length * 9));

  const renderIcon = (kind: ActivityKind) => {
    switch (kind) {
      case "panel":
        return <Server className="w-3.5 h-3.5 text-primary shrink-0" />;
      case "chat":
        return <MessageCircle className="w-3.5 h-3.5 text-accent shrink-0" />;
      case "feedback":
        return <Star className="w-3.5 h-3.5 text-amber shrink-0" />;
    }
  };

  if (looped.length === 0) {
    return (
      <div className="mb-3 rounded-full border border-border/50 bg-secondary/40 px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
        <span>Menunggu aktivitas pengguna...</span>
      </div>
    );
  }

  // Duplicate the list so translateX(-50%) loops seamlessly
  const doubled = [...looped, ...looped];

  return (
    <div className="mb-3 rounded-full border border-border/50 bg-secondary/40 overflow-hidden flex items-center">
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary/15 border-r border-border/50 h-full">
        <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
          Live
        </span>
      </div>
      <div className="flex-1 min-w-0 overflow-hidden relative py-2">
        <div
          className="flex w-max animate-marquee whitespace-nowrap"
          style={{ ["--marquee-duration" as any]: `${duration}s` }}
        >
          {doubled.map((it, idx) => (
            <div
              key={`${it.id}-${idx}`}
              className="flex items-center gap-1.5 px-4 text-xs text-foreground"
            >
              {renderIcon(it.kind)}
              <span className="font-semibold">{it.text}</span>
              {it.detail && (
                <span className="text-muted-foreground">— {it.detail}</span>
              )}
              <span className="text-[10px] text-muted-foreground/70">
                · {relativeTime(it.created_at)}
              </span>
              <span className="mx-2 text-border">•</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ActivityTicker;