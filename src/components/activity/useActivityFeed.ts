import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FeedItem } from "./types";

/** Shared hook: loader, planMap, realtime, search, pagination */
export function useActivityFeed(
  loader: () => Promise<FeedItem[]>,
  deps: any[] = [],
) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [planMap, setPlanMap] = useState<Record<string, { plan: string | null; permanent: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [, setTick] = useState(0);
  const PAGE_SIZE = 50;

  const load = async () => {
    try {
      const [data, usersRes] = await Promise.all([loader(), supabase.rpc("get_public_users")]);
      setItems(data);
      if (!usersRes.error && usersRes.data) {
        const map: Record<string, { plan: string | null; permanent: boolean }> = {};
        for (const u of usersRes.data as Array<{
          user_id: string; reseller_plan: string | null; reseller_permanent: boolean;
        }>) {
          map[u.user_id] = { plan: u.reseller_plan ?? null, permanent: !!u.reseller_permanent };
        }
        setPlanMap(map);
      }
    } catch (e) {
      console.error("Activity load failed:", e);
      toast.error("Gagal memuat aktivitas");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const channel = supabase
      .channel("activity-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_events" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { setPage(1); }, [search]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) => {
      const fields: (string | null | undefined)[] = [a.full_name, a.role];
      if (a.kind === "panel") fields.push(a.username, a.server_name, a.server_domain);
      if (a.kind === "upgrade") fields.push(a.plan, String(a.amount));
      if (a.kind === "admin_cleanup") fields.push(a.server_name, String(a.count));
      if (a.kind === "ad") fields.push(a.title, a.event);
      if (a.kind === "panel_deleted") fields.push(a.username, a.server_name, a.panel_type);
      if (a.kind === "admin_panel") fields.push(a.username, a.server_name);
      if (a.kind === "user_deleted") fields.push(a.email);
      return fields.filter(Boolean).some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  );

  return {
    items, planMap, loading, refreshing, search, setSearch,
    page: safePage, setPage, totalPages, paginated, filtered,
    handleRefresh, PAGE_SIZE,
  };
}