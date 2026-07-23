import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ActivityLayout from "@/components/activity/ActivityLayout";
import ActivityFeedList from "@/components/activity/ActivityFeedList";
import { useActivityFeed } from "@/components/activity/useActivityFeed";
import { FeedItem } from "@/components/activity/types";

const PanelActivityPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const feed = useActivityFeed(async () => {
    const [panelRes, cleanupRes, extraRes] = await Promise.all([
      (supabase.rpc as any)("get_panel_activity", { _limit: 500 }),
      supabase.from("activity_events")
        .select("id, actor_user_id, actor_name, actor_role, detail, amount, created_at")
        .eq("kind", "admin_cleanup").order("created_at", { ascending: false }).limit(200),
      supabase.from("activity_events")
        .select("id, kind, actor_user_id, actor_name, actor_role, detail, amount, created_at")
        .in("kind", ["panel_deleted", "admin_panel", "user_deleted"])
        .order("created_at", { ascending: false }).limit(500),
    ]);
    const merged: FeedItem[] = [];
    if (panelRes.data) merged.push(...(panelRes.data as any[]).map((p) => ({ kind: "panel" as const, ...p })));
    if (cleanupRes.data) {
      merged.push(...(cleanupRes.data as any[]).map((r) => {
        const [countStr, serverName] = (r.detail || "").split("|");
        return {
          kind: "admin_cleanup" as const, id: r.id, user_id: r.actor_user_id || "",
          full_name: r.actor_name, avatar_url: null, role: r.actor_role || "admin",
          count: r.amount ?? (parseInt(countStr || "0", 10) || 0),
          server_name: serverName || "Server", created_at: r.created_at,
        };
      }));
    }
    if (extraRes.data) {
      for (const r of extraRes.data as any[]) {
        if (r.kind === "panel_deleted") {
          const [uname, ptype, srv] = (r.detail || "").split("|");
          merged.push({
            kind: "panel_deleted", id: r.id, user_id: r.actor_user_id || "",
            full_name: r.actor_name, avatar_url: null, role: r.actor_role || "free",
            username: uname || "", panel_type: ptype || "nodejs", server_name: srv || "",
            created_at: r.created_at,
          });
        } else if (r.kind === "admin_panel") {
          const [uname, srv] = (r.detail || "").split("|");
          merged.push({
            kind: "admin_panel", id: r.id, user_id: r.actor_user_id || "",
            full_name: r.actor_name, avatar_url: null, role: r.actor_role || "adp_server",
            username: uname || "", server_name: srv || "", created_at: r.created_at,
          });
        } else if (r.kind === "user_deleted") {
          merged.push({
            kind: "user_deleted", id: r.id, user_id: r.actor_user_id || "",
            full_name: r.actor_name, avatar_url: null, role: r.actor_role || "free",
            email: r.detail || "", created_at: r.created_at,
          });
        }
      }
    }
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return merged;
  }, [user?.id]);

  return (
    <ActivityLayout
      title="Aktivitas Panel"
      description="Log panel dibuat, dihapus, admin panel & cleanup"
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
        emptyText="Belum ada aktivitas panel."
        searchPlaceholder="Cari nama, username panel, atau server..."
      />
    </ActivityLayout>
  );
};

export default PanelActivityPage;