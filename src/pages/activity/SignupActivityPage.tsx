import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ActivityLayout from "@/components/activity/ActivityLayout";
import ActivityFeedList from "@/components/activity/ActivityFeedList";
import { useActivityFeed } from "@/components/activity/useActivityFeed";
import { FeedItem } from "@/components/activity/types";

const SignupActivityPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const feed = useActivityFeed(async () => {
    const res = await (supabase.rpc as any)("get_signup_activity", { _limit: 500 });
    const data = (res.data ?? []) as any[];
    return data.map((s): FeedItem => ({ kind: "signup", ...s }));
  }, [user?.id]);

  return (
    <ActivityLayout
      title="Aktivitas Pendaftar"
      description="Log pendaftaran user baru secara real-time"
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
        emptyText="Belum ada pendaftar baru."
        searchPlaceholder="Cari nama pendaftar..."
      />
    </ActivityLayout>
  );
};

export default SignupActivityPage;