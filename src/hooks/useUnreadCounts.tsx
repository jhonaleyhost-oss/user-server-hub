import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UnreadCounts {
  chat: number;
  support: number;
}

export function useUnreadCounts(): UnreadCounts {
  const { user } = useAuth();
  const [counts, setCounts] = useState<UnreadCounts>({ chat: 0, support: 0 });
  const debounceRef = useRef<number | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!user) {
      setCounts({ chat: 0, support: 0 });
      return;
    }
    const { data } = await (supabase.rpc as any)("get_unread_counts");
    if (data && data.length > 0) {
      setCounts({
        chat: Number(data[0].chat_unread ?? 0),
        support: Number(data[0].support_unread ?? 0),
      });
    }
  }, [user]);

  const scheduleRefetch = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      fetchCounts();
    }, 400);
  }, [fetchCounts]);

  useEffect(() => {
    if (!user) return;
    fetchCounts();

    const ch = supabase
      .channel("unread-counts-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reads" }, scheduleRefetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, scheduleRefetch)
      .subscribe();

    const onFocus = () => fetchCounts();
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [user, fetchCounts, scheduleRefetch]);

  return counts;
}