import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  banner_url: string | null;
  link_url: string | null;
  audience: string;
  created_at: string;
  is_read: boolean;
}

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setItems([]); setUnread(0); setLoading(false); return;
    }
    const [a, b] = await Promise.all([
      (supabase.rpc as any)("get_my_notifications", { _limit: 50 }),
      (supabase.rpc as any)("get_unread_notification_count"),
    ]);
    if (a.data) setItems(a.data as AppNotification[]);
    if (typeof b.data === "number") setUnread(b.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchAll();
    const ch = supabase
      .channel("notif-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_reads", filter: `user_id=eq.${user.id}` }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchAll]);

  const markAllRead = async () => {
    await (supabase.rpc as any)("mark_all_notifications_read");
    fetchAll();
  };

  const markOneRead = async (id: string) => {
    if (!user) return;
    await supabase.from("notification_reads").upsert({ notification_id: id, user_id: user.id });
    fetchAll();
  };

  return { items, unread, loading, refetch: fetchAll, markAllRead, markOneRead };
}