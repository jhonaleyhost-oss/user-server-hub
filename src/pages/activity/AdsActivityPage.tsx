import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ActivityLayout from "@/components/activity/ActivityLayout";
import ActivityFeedList from "@/components/activity/ActivityFeedList";
import { useActivityFeed } from "@/components/activity/useActivityFeed";
import { FeedItem } from "@/components/activity/types";

const AdsActivityPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const feed = useActivityFeed(async () => {
    const res = await supabase.from("activity_events")
      .select("id, kind, actor_user_id, actor_name, actor_role, detail, amount, created_at")
      .in("kind", ["ad_rental", "ad_expired", "role_expired"])
      .order("created_at", { ascending: false }).limit(300);
    const data = (res.data ?? []) as any[];
    return data.map((r): FeedItem => ({
      kind: "ad",
      id: r.id,
      user_id: r.actor_user_id || "",
      full_name: r.actor_name,
      avatar_url: null,
      role: r.actor_role || "free",
      event: r.kind,
      title: r.detail || (r.kind === "role_expired" ? "Reseller" : "Iklan"),
      amount: r.amount,
      created_at: r.created_at,
    }));
  }, [user?.id]);

  return (
    <ActivityLayout
      title="Aktivitas Iklan"
      description="Log sewa iklan & role expiry"
      onRefresh={feed.handleRefresh}
      refreshing={feed.refreshing}
    >
      <ActivityFeedList
        loading={feed.loading}
        search={feed.search}
        setSearch={feed.setSearch}
        paginated={feed.paginated}
        filtered={feed.filtered}
        page={feed.page}
        setPage={feed.setPage}
        totalPages={feed.totalPages}
        planMap={feed.planMap}
        pageSize={feed.PAGE_SIZE}
        emptyText="Belum ada aktivitas iklan."
        searchPlaceholder="Cari nama atau judul iklan..."
      />
    </ActivityLayout>
  );
};

export default AdsActivityPage;