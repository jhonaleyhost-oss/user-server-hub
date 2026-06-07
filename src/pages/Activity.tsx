import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity as ActivityIcon, Server, Cpu, HardDrive, MemoryStick, RefreshCcw, UserPlus, Crown, Calendar, Wallet, Infinity as InfinityIcon, ChevronLeft, ChevronRight, Code2, ShieldAlert, Trash2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import VerifiedBadge from "@/components/VerifiedBadge";

interface PanelActivity {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  username: string;
  ram: number;
  cpu: number;
  disk: number;
  server_name: string | null;
  server_domain: string | null;
  panel_type: string | null;
  created_at: string;
}

interface SignupActivity {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
}

interface UpgradeActivity {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  plan: '1bln' | '2bln' | 'perm';
  amount: number;
  duration_days: number | null;
  paid_at: string | null;
  expires_at: string | null;
  permanent: boolean;
  created_at: string;
}

interface AdminCleanupActivity {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  count: number;
  server_name: string;
  created_at: string;
}

type FeedItem =
  | ({ kind: "panel" } & PanelActivity)
  | ({ kind: "signup" } & SignupActivity)
  | ({ kind: "upgrade" } & UpgradeActivity)
  | ({ kind: "admin_cleanup" } & AdminCleanupActivity);

const formatSpec = (n: number) => (n === 0 ? "Unlimited" : `${n}`);

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}d lalu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  const d = Math.floor(h / 24);
  return `${d}h lalu`;
};

const Activity = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [panels, setPanels] = useState<PanelActivity[]>([]);
  const [signups, setSignups] = useState<SignupActivity[]>([]);
  const [upgrades, setUpgrades] = useState<UpgradeActivity[]>([]);
  const [cleanups, setCleanups] = useState<AdminCleanupActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [, setTick] = useState(0);
  const [tab, setTab] = useState<"panel" | "signup" | "upgrade" | "admin">("panel");
  const [planMap, setPlanMap] = useState<Record<string, { plan: string | null; permanent: boolean }>>({});
  const [page, setPage] = useState(1);
  const [totalCounts, setTotalCounts] = useState<{ panel: number; signup: number; upgrade: number; admin: number }>({
    panel: 0,
    signup: 0,
    upgrade: 0,
    admin: 0,
  });
  const PAGE_SIZE = 50;

  // Reset to page 1 when tab or search changes
  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const load = async () => {
    const [panelRes, signupRes, upgradeRes, usersRes, cleanupRes] = await Promise.all([
      (supabase.rpc as any)("get_panel_activity", { _limit: 500 }),
      (supabase.rpc as any)("get_signup_activity", { _limit: 500 }),
      (supabase.rpc as any)("get_upgrade_activity", { _limit: 500 }),
      supabase.rpc("get_public_users"),
      supabase
        .from("activity_events")
        .select("id, actor_user_id, actor_name, actor_role, detail, amount, created_at")
        .eq("kind", "admin_cleanup")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (panelRes.error || signupRes.error || upgradeRes.error) {
      toast.error("Gagal memuat aktivitas");
      return;
    }
    setPanels((panelRes.data ?? []) as PanelActivity[]);
    setSignups((signupRes.data ?? []) as SignupActivity[]);
    setUpgrades((upgradeRes.data ?? []) as UpgradeActivity[]);
    // Load total counts in background (don't block main render)
    Promise.all([
      supabase.from("activity_events").select("id", { count: "exact", head: true }).eq("kind", "panel"),
      supabase.from("activity_events").select("id", { count: "exact", head: true }).eq("kind", "signup"),
      supabase.from("activity_events").select("id", { count: "exact", head: true }).eq("kind", "upgrade"),
      supabase.from("activity_events").select("id", { count: "exact", head: true }).eq("kind", "admin_cleanup"),
    ]).then(([pc, sc, uc, ac]) => {
      setTotalCounts({
        panel: pc.count ?? (panelRes.data?.length ?? 0),
        signup: sc.count ?? (signupRes.data?.length ?? 0),
        upgrade: uc.count ?? (upgradeRes.data?.length ?? 0),
        admin: ac.count ?? 0,
      });
    }).catch((e) => console.error("Count fetch failed:", e));
    if (!cleanupRes.error && cleanupRes.data) {
      const rows = cleanupRes.data as Array<{
        id: string; actor_user_id: string | null; actor_name: string | null;
        actor_role: string | null; detail: string | null; amount: number | null; created_at: string;
      }>;
      setCleanups(rows.map(r => {
        const [countStr, serverName] = (r.detail || "").split("|");
        return {
          id: r.id,
          user_id: r.actor_user_id || "",
          full_name: r.actor_name,
          avatar_url: null,
          role: r.actor_role || "admin",
          count: r.amount ?? (parseInt(countStr || "0", 10) || 0),
          server_name: serverName || "Server",
          created_at: r.created_at,
        };
      }));
    }
    if (!usersRes.error && usersRes.data) {
      const map: Record<string, { plan: string | null; permanent: boolean }> = {};
      for (const u of usersRes.data as Array<{
        user_id: string;
        reseller_plan: string | null;
        reseller_permanent: boolean;
      }>) {
        map[u.user_id] = {
          plan: u.reseller_plan ?? null,
          permanent: !!u.reseller_permanent,
        };
      }
      setPlanMap(map);
    }
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        console.error("Activity load failed:", e);
        toast.error("Gagal memuat aktivitas");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Realtime subscription — when any new panel is created, prepend a fresh row
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("activity-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events" },
        () => {
          load();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Re-render every 30s so relative timestamps stay fresh
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const current = useMemo<FeedItem[]>(() => {
    if (tab === "panel") {
      return panels.map((p) => ({ kind: "panel" as const, ...p }));
    }
    if (tab === "upgrade") {
      return upgrades.map((u) => ({ kind: "upgrade" as const, ...u }));
    }
    if (tab === "admin") {
      return cleanups.map((c) => ({ kind: "admin_cleanup" as const, ...c }));
    }
    return signups.map((s) => ({ kind: "signup" as const, ...s }));
  }, [tab, panels, signups, upgrades, cleanups]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return current;
    return current.filter((a) => {
      const fields: (string | null | undefined)[] = [a.full_name, a.role];
      if (a.kind === "panel") fields.push(a.username, a.server_name, a.server_domain);
      if (a.kind === "upgrade") fields.push(a.plan, String(a.amount));
      if (a.kind === "admin_cleanup") fields.push(a.server_name, String(a.count));
      return fields.filter(Boolean).some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [current, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  return (
    <AppShell>
      <PageTransition>
        <div className="p-3 sm:p-4 max-w-4xl mx-auto">
          <GlassCard className="!rounded-3xl p-4 mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                <ActivityIcon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-foreground truncate">Aktivitas Pengguna</h1>
                <p className="text-xs text-muted-foreground truncate">
                  {tab === "panel"
                    ? "Log pembuatan panel secara real-time"
                    : tab === "signup"
                    ? "Log pendaftaran user baru secara real-time"
                    : tab === "upgrade"
                    ? "Log upgrade Reseller secara real-time"
                    : "Log admin membersihkan panel offline"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-10 w-10 rounded-full shrink-0"
              aria-label="Refresh"
            >
              <RefreshCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </GlassCard>

          <GlassCard className="!rounded-full p-1 mb-3 flex gap-1 overflow-x-auto">
            <button
              type="button"
              onClick={() => setTab("panel")}
              className={`flex-1 h-9 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                tab === "panel"
                  ? "bg-gradient-to-r from-primary to-accent text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              Panel
              <span className="ml-1 text-[10px] opacity-80">({totalCounts.panel || panels.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={`flex-1 h-9 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                tab === "signup"
                  ? "bg-gradient-to-r from-primary to-accent text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Pendaftar
              <span className="ml-1 text-[10px] opacity-80">({totalCounts.signup || signups.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("upgrade")}
              className={`flex-1 h-9 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                tab === "upgrade"
                  ? "bg-gradient-to-r from-amber to-primary text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              Upgrade
              <span className="ml-1 text-[10px] opacity-80">({totalCounts.upgrade || upgrades.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("admin")}
              className={`flex-1 h-9 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                tab === "admin"
                  ? "bg-gradient-to-r from-rose-500 to-primary text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Admin
              <span className="ml-1 text-[10px] opacity-80">({totalCounts.admin || cleanups.length})</span>
            </button>
          </GlassCard>

          <GlassCard className="!rounded-3xl p-3 mb-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "panel"
                  ? "Cari nama, username panel, atau server..."
                  : tab === "signup"
                  ? "Cari nama pendaftar..."
                  : "Cari nama atau paket..."
              }
              className="rounded-full h-10 bg-secondary/60 border-border/50"
            />
          </GlassCard>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <GlassCard key={i} className="!rounded-2xl p-4 animate-pulse h-24">
                  <span />
                </GlassCard>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <GlassCard className="!rounded-3xl p-10 text-center">
              <ActivityIcon className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {current.length === 0
                  ? tab === "panel"
                    ? "Belum ada aktivitas pembuatan panel."
                    : tab === "signup"
                    ? "Belum ada pendaftar baru."
                    : "Belum ada upgrade Reseller."
                  : "Tidak ada yang cocok dengan pencarian."}
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-2.5">
              {paginated.map((a) => {
                const name = a.full_name?.trim() || "Pengguna";
                const initial = name.charAt(0).toUpperCase();
                return (
                  <GlassCard
                    key={`${a.kind}-${a.id}`}
                    className="!rounded-2xl p-3.5 sm:p-4 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {a.avatar_url ? (
                        <img
                          src={a.avatar_url}
                          alt={name}
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="text-sm font-bold text-foreground truncate max-w-[160px]">
                            {name}
                          </span>
                          <VerifiedBadge
                            role={a.role}
                            plan={
                              a.kind === "upgrade"
                                ? a.plan
                                : planMap[a.user_id]?.plan
                            }
                            permanent={
                              a.kind === "upgrade"
                                ? a.permanent
                                : planMap[a.user_id]?.permanent
                            }
                            size={14}
                          />
                          <span
                            className="text-[10px] text-muted-foreground ml-auto"
                            title={formatDateTime(a.created_at)}
                          >
                            {relativeTime(a.created_at)}
                          </span>
                        </div>

                        {a.kind === "panel" ? (
                          <>
                            <p className="text-xs text-muted-foreground mb-2">
                              Membuat panel{" "}
                              <span className="font-semibold text-foreground">{a.username}</span>
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                                <Server className="w-3 h-3 text-primary" />
                                <span className="truncate max-w-[140px]">
                                  {a.server_name || a.server_domain || "Unknown"}
                                </span>
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold ${
                                  a.panel_type === "python"
                                    ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                }`}
                              >
                                <Code2 className="w-3 h-3" />
                                {a.panel_type === "python" ? "Python" : "NodeJS"}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                                <MemoryStick className="w-3 h-3 text-accent" />
                                RAM {formatSpec(a.ram)}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                                <Cpu className="w-3 h-3 text-amber" />
                                CPU {formatSpec(a.cpu)}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                                <HardDrive className="w-3 h-3 text-emerald-500" />
                                Disk {formatSpec(a.disk)}
                              </span>
                            </div>
                          </>
                        ) : a.kind === "signup" ? (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                              <UserPlus className="w-3 h-3" />
                              Bergabung
                            </span>
                            <span className="text-muted-foreground">sebagai pengguna baru</span>
                          </div>
                        ) : a.kind === "admin_cleanup" ? (
                          <>
                            <p className="text-xs text-muted-foreground mb-2">
                              Membersihkan{" "}
                              <span className="font-semibold text-rose-400">{a.count} panel offline</span>
                              {" • "}
                              <span className="font-semibold text-foreground">{a.server_name}</span>
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                                <Trash2 className="w-3 h-3" />
                                Cleanup
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                                <Server className="w-3 h-3 text-primary" />
                                {a.server_name}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground mb-2">
                              Upgrade ke{" "}
                              <span className="font-semibold text-amber">Reseller</span>
                              {" • "}
                              <span className="font-semibold text-foreground">
                                {a.plan === "perm" ? "Permanen" : a.plan === "2bln" ? "2 Bulan" : "1 Bulan"}
                              </span>
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber/10 border border-amber/30 text-amber font-bold">
                                <Wallet className="w-3 h-3" />
                                Rp {a.amount.toLocaleString("id-ID")}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                                <Calendar className="w-3 h-3 text-primary" />
                                Beli {formatDateTime(a.paid_at || a.created_at)}
                              </span>
                              {a.permanent ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber/20 to-primary/20 border border-amber/40 text-amber font-bold">
                                  <InfinityIcon className="w-3 h-3" />
                                  Permanen
                                </span>
                              ) : (
                                <>
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                                    <Crown className="w-3 h-3 text-accent" />
                                    Durasi {a.duration_days} hari
                                  </span>
                                  {a.expires_at && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/30 text-destructive">
                                      <Calendar className="w-3 h-3" />
                                      Expired {formatDateTime(a.expires_at)}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}

          {!loading && filtered.length > PAGE_SIZE && (
            <GlassCard className="!rounded-full p-2 mt-3 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="h-9 w-9 rounded-full shrink-0"
                aria-label="Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-xs text-muted-foreground text-center flex-1">
                Halaman <span className="font-semibold text-foreground">{safePage}</span> / {totalPages}
                <span className="hidden sm:inline"> • {filtered.length} total</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="h-9 w-9 rounded-full shrink-0"
                aria-label="Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </GlassCard>
          )}
        </div>
      </PageTransition>
    </AppShell>
  );
};

export default Activity;