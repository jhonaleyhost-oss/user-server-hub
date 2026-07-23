import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users as UsersIcon, Search, Loader2, Calendar, Server, Shield, ArrowUpDown, Circle, Crown, LayoutDashboard } from "lucide-react";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import AppShell from "@/components/AppShell";
import GlassCard from "@/components/GlassCard";
import { PageTransition } from "@/components/PageTransition";
import VerifiedBadge from "@/components/VerifiedBadge";
import AdminPagination from "@/components/AdminPagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Role = "admin" | "adp_server" | "reseller" | "premium" | "free";

interface UserRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  panel_count: number;
  created_at: string | null;
  reseller_plan?: string | null;
  reseller_permanent?: boolean | null;
}

const roleLabel = (role: Role) =>
  role === "admin" ? "Admin" : role === "adp_server" ? "ADP" : role === "reseller" ? "Reseller" : role === "premium" ? "Premium" : "Free";

type SortKey =
  | "newest"
  | "oldest"
  | "panels_desc"
  | "panels_asc"
  | "name_asc"
  | "name_desc";

const sortLabel: Record<SortKey, string> = {
  newest: "Terbaru Bergabung",
  oldest: "Terlama Bergabung",
  panels_desc: "Panel Terbanyak",
  panels_asc: "Panel Tersedikit",
  name_asc: "Nama A-Z",
  name_desc: "Nama Z-A",
};

export default function Users() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const { onlineCount } = useOnlinePresence();

  const ROLE_FILTERS: { value: "all" | Role; label: string; color: string }[] = [
    { value: "all", label: "Semua", color: "text-foreground" },
    { value: "reseller", label: "Reseller", color: "text-amber" },
    { value: "adp_server", label: "Admin Panel", color: "text-rose-400" },
  ];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const BATCH = 1000;
      let offset = 0;
      const all: any[] = [];
      // Fetch in batches to bypass PostgREST default max-rows cap
      // Keep going until the RPC returns fewer rows than the batch size
      // (safety cap at 100k to avoid runaway loops)
      while (offset < 100000) {
        const { data, error } = await supabase
          .rpc("get_public_users")
          .range(offset, offset + BATCH - 1);
        if (error || !data || data.length === 0) break;
        all.push(...data);
        if (data.length < BATCH) break;
        offset += BATCH;
      }
      const merged: UserRow[] = all.map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        role: (p.role ?? "free") as Role,
        panel_count: Number(p.panel_count ?? 0),
        created_at: p.created_at ?? null,
        reseller_plan: p.reseller_plan ?? null,
        reseller_permanent: p.reseller_permanent ?? false,
      }));
      setUsers(merged);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, roleFilter]);

  const filtered = users
    .filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    })
    .slice()
    .sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      const an = (a.full_name ?? "").toLowerCase();
      const bn = (b.full_name ?? "").toLowerCase();
      switch (sortBy) {
        case "newest":
          return bt - at;
        case "oldest":
          return at - bt;
        case "panels_desc":
          return b.panel_count - a.panel_count;
        case "panels_asc":
          return a.panel_count - b.panel_count;
        case "name_asc":
          return an.localeCompare(bn);
        case "name_desc":
          return bn.localeCompare(an);
      }
    });

  const total = users.length;
  const totalReseller = users.filter((u) => u.role === "reseller").length;
  const totalAdp = users.filter((u) => u.role === "adp_server" || u.role === "admin").length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <AppShell>
      <PageTransition>
        <div className="p-4 max-w-5xl mx-auto space-y-4">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">Pengguna</h1>
              <p className="text-xs text-muted-foreground">Daftar seluruh pengguna terdaftar</p>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <GlassCard className="p-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Pengguna</p>
              <p className="text-2xl font-bold text-foreground">{total}</p>
            </GlassCard>
            <GlassCard className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500 animate-pulse" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Online</p>
              </div>
              <p className="text-2xl font-bold text-green-500">{onlineCount}</p>
            </GlassCard>
            <GlassCard className="p-4 flex items-center justify-between border-amber/20">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Reseller</p>
              </div>
              <p className="text-2xl font-bold text-amber">{totalReseller}</p>
            </GlassCard>
            <GlassCard className="p-4 flex items-center justify-between border-rose-400/20">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-rose-400" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin Panel</p>
              </div>
              <p className="text-2xl font-bold text-rose-400">{totalAdp}</p>
            </GlassCard>
          </div>

          {/* Search + Sort */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-full"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="h-10 w-auto min-w-[44px] px-4 gap-2 rounded-full">
                <ArrowUpDown className="w-4 h-4 text-primary shrink-0" />
                <span className="hidden sm:inline text-xs">{sortLabel[sortBy]}</span>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(sortLabel) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {sortLabel[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Role filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
            {ROLE_FILTERS.map((r) => {
              const active = roleFilter === r.value;
              return (
                <button
                  key={r.value}
                  onClick={() => setRoleFilter(r.value)}
                  className={`
                    shrink-0 h-9 px-4 rounded-full text-xs font-medium border transition-all
                    ${active ? `bg-primary/15 border-primary/50 ${r.color}` : "bg-secondary/40 border-white/5 text-muted-foreground hover:border-white/15"}
                  `}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <GlassCard className="p-8 text-center text-sm text-muted-foreground">
              Tidak ada pengguna ditemukan.
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {paginated.map((u, i) => {
                const username = u.full_name?.trim() || "Pengguna";
                const initial = username.charAt(0).toUpperCase();
                return (
                  <div
                    key={u.user_id}
                    onClick={() => setSelected(u)}
                    className="cursor-pointer"
                  >
                    <GlassCard className="!rounded-full p-2 pr-4 flex items-center gap-3 hover:border-primary/40 transition-colors">
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={username}
                          className="w-11 h-11 rounded-full object-cover shrink-0 border border-border/50"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white shrink-0">
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{username}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                          <Server className="w-3 h-3 shrink-0" />
                          <span>{u.panel_count} panel</span>
                          {u.created_at && (
                            <>
                              <span className="opacity-40">•</span>
                              <Calendar className="w-3 h-3 shrink-0" />
                              <span className="truncate">
                                {new Date(u.created_at).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "short",
                                  year: "2-digit",
                                })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <VerifiedBadge
                        role={u.role}
                        plan={u.reseller_plan}
                        permanent={u.reseller_permanent}
                        size={18}
                        className="shrink-0"
                      />
                    </GlassCard>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && filtered.length > PAGE_SIZE && (
            <AdminPagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filtered.length}
              itemsPerPage={PAGE_SIZE}
            />
          )}
        </div>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle>Profil Pengguna</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-4">
                <div className="flex flex-col items-center text-center gap-3 pt-2">
                  {selected.avatar_url ? (
                    <img
                      src={selected.avatar_url}
                      alt={selected.full_name ?? "Pengguna"}
                      className="w-20 h-20 rounded-full object-cover border border-border/50"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white text-2xl">
                      {(selected.full_name?.trim() || "P").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="inline-flex items-center gap-1.5">
                      <p className="text-lg font-bold text-foreground">
                        {selected.full_name?.trim() || "Pengguna"}
                      </p>
                      <VerifiedBadge
                        role={selected.role}
                        plan={selected.reseller_plan}
                        permanent={selected.reseller_permanent}
                        size={18}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-secondary/60 to-secondary/20 border border-white/5 shadow-inner">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Server className="w-4 h-4 text-primary" />
                      Panel Dibuat
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {selected.panel_count}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-secondary/60 to-secondary/20 border border-white/5 shadow-inner">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="w-4 h-4 text-accent" />
                      Role
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {roleLabel(selected.role)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-secondary/60 to-secondary/20 border border-white/5 shadow-inner">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4 text-amber" />
                      Bergabung
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {selected.created_at
                        ? new Date(selected.created_at).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "-"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageTransition>
    </AppShell>
  );
}