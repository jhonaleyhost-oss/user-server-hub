import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users as UsersIcon, Search, Loader2, Calendar, Server, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import AppShell from "@/components/AppShell";
import GlassCard from "@/components/GlassCard";
import { PageTransition } from "@/components/PageTransition";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Role = "admin" | "reseller" | "premium" | "free";

interface UserRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
  panel_count: number;
  created_at: string | null;
}

const roleStyle = (role: Role) => {
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

const roleLabel = (role: Role) =>
  role === "admin" ? "Admin" : role === "reseller" ? "Reseller" : role === "premium" ? "Premium" : "Free";

export default function Users() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<UserRow | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_public_users");
      const merged: UserRow[] = (data ?? []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        role: (p.role ?? "free") as Role,
        panel_count: Number(p.panel_count ?? 0),
        created_at: p.created_at ?? null,
      }));
      setUsers(merged);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.full_name ?? "").toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const total = users.length;

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
          <GlassCard className="p-4 flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Pengguna</p>
            <p className="text-2xl font-bold text-foreground">{total}</p>
          </GlassCard>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
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
              {filtered.map((u, i) => {
                const username = u.full_name?.trim() || "Pengguna";
                const initial = username.charAt(0).toUpperCase();
                return (
                  <div key={u.user_id}>
                    <GlassCard
                      onClick={() => setSelected(u)}
                      className="p-3 flex items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors"
                    >
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
                        <p className="text-[11px] text-muted-foreground truncate">
                          {u.panel_count} panel
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border shrink-0 ${roleStyle(u.role)}`}
                      >
                        {roleLabel(u.role)}
                      </span>
                    </GlassCard>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-sm">
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
                    <p className="text-lg font-bold text-foreground">
                      {selected.full_name?.trim() || "Pengguna"}
                    </p>
                    <span
                      className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${roleStyle(selected.role)}`}
                    >
                      {roleLabel(selected.role)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Server className="w-4 h-4 text-primary" />
                      Panel Dibuat
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {selected.panel_count}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/50">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="w-4 h-4 text-accent" />
                      Role
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {roleLabel(selected.role)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/40 border border-border/50">
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