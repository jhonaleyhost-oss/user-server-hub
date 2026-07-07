import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, Radio } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface UpgradeItem {
  id: string;
  text: string;
  detail?: string;
  created_at: string;
}

type ProfileLite = {
  user_id: string;
  full_name: string | null;
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

const planLabel = (plan: string | null | undefined) => {
  const raw = (plan || "").replace(/^adp_/, "");
  switch (raw) {
    case "perm":
      return "Permanen";
    case "1bln":
      return "1 Bulan";
    case "2bln":
      return "2 Bulan";
    default:
      return raw || "Reseller";
  }
};

const productLabel = (plan: string | null | undefined) =>
  typeof plan === "string" && plan.startsWith("adp_") ? "ADP Server" : "Reseller";

const MAX_ITEMS = 20;

const UpgradeTicker = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<UpgradeItem[]>([]);
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

  const push = (item: UpgradeItem) => {
    setItems((prev) => {
      if (prev.some((x) => x.id === item.id)) return prev;
      return [item, ...prev].slice(0, MAX_ITEMS);
    });
  };

  // Initial backfill from completed reseller orders
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      await loadProfiles();
      const { data } = await (supabase.rpc as any)("get_upgrade_activity", { _limit: 20 });
      if (cancelled || !data) return;
      const collected: UpgradeItem[] = (data as Array<{
        id: string;
        user_id: string;
        full_name: string | null;
        plan: string;
        paid_at: string | null;
        created_at: string;
      }>).map((o) => ({
        id: `upg-${o.id}`,
        text: `${o.full_name?.trim() || "Seseorang"} upgrade ${productLabel(o.plan)}`,
        detail: planLabel(o.plan),
        created_at: o.paid_at || o.created_at,
      }));
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

  // Realtime: listen for new upgrade events
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("upgrade-ticker")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events", filter: "kind=eq.upgrade" },
        async (payload) => {
          const row = payload.new as {
            id: string;
            actor_user_id: string;
            actor_name: string | null;
            detail: string | null;
            created_at: string;
          };
          const name = row.actor_name?.trim() || (await nameOf(row.actor_user_id));
          push({
            id: `upg-evt-${row.id}`,
            text: `${name} upgrade ${productLabel(row.detail)}`,
            detail: planLabel(row.detail),
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

  // Refresh relative timestamps
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const looped = useMemo(() => {
    if (items.length === 0) return [];
    let arr = items.slice();
    while (arr.length < 6) arr = arr.concat(items);
    return arr;
  }, [items]);

  const duration = Math.max(50, Math.min(140, looped.length * 9));

  if (looped.length === 0) {
    return (
      <div className="mb-3 rounded-full border border-border/50 bg-secondary/40 px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
        <Crown className="w-3.5 h-3.5 text-amber-400" />
        <span>Belum ada upgrade reseller...</span>
      </div>
    );
  }

  const doubled = [...looped, ...looped];

  return (
    <div className="mb-3 rounded-full border border-border/50 bg-secondary/40 overflow-hidden flex items-center">
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-400/15 border-r border-border/50 h-full">
        <Crown className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400">
          Upgrade
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
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
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

export default UpgradeTicker;