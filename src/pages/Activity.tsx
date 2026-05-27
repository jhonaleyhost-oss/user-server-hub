import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity as ActivityIcon, Server, Cpu, HardDrive, MemoryStick, RefreshCcw } from "lucide-react";
import AppShell from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  created_at: string;
}

const roleStyle = (role: string) => {
  switch (role) {
    case "admin":
      return "bg-amber/15 text-amber border-amber/30";
    case "reseller":
      return "bg-primary/15 text-primary border-primary/30";
    case "premium":
      return "bg-accent/15 text-accent border-accent/30";
    default:
      return "bg-secondary text-muted-foreground border-border";
  }
};

const roleLabel = (role: string) => {
  switch (role) {
    case "admin":
      return "Admin";
    case "reseller":
      return "Reseller";
    case "premium":
      return "Premium";
    default:
      return "Free";
  }
};

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
  const [items, setItems] = useState<PanelActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [, setTick] = useState(0);
  const itemsRef = useRef<PanelActivity[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const load = async () => {
    const { data, error } = await (supabase.rpc as any)("get_panel_activity", { _limit: 200 });
    if (error) {
      toast.error("Gagal memuat aktivitas");
      return;
    }
    setItems((data ?? []) as PanelActivity[]);
  };

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
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
        { event: "INSERT", schema: "public", table: "user_panels" },
        () => {
          // Easiest: refetch (RPC enriches with profile/role/server data)
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((a) =>
      [a.full_name, a.username, a.server_name, a.server_domain, a.role]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [items, search]);

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
                  Log pembuatan panel secara real-time
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

          <GlassCard className="!rounded-3xl p-3 mb-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, username panel, atau server..."
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
                {items.length === 0 ? "Belum ada aktivitas pembuatan panel." : "Tidak ada yang cocok dengan pencarian."}
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-2.5">
              {filtered.map((a) => {
                const name = a.full_name?.trim() || "Pengguna";
                const initial = name.charAt(0).toUpperCase();
                return (
                  <GlassCard
                    key={a.id}
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
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${roleStyle(
                              a.role
                            )}`}
                          >
                            {roleLabel(a.role)}
                          </span>
                          <span
                            className="text-[10px] text-muted-foreground ml-auto"
                            title={formatDateTime(a.created_at)}
                          >
                            {relativeTime(a.created_at)}
                          </span>
                        </div>

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
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>
      </PageTransition>
    </AppShell>
  );
};

export default Activity;