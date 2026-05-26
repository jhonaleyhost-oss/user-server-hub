import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users as UsersIcon, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import AppShell from "@/components/AppShell";
import GlassCard from "@/components/GlassCard";
import { PageTransition } from "@/components/PageTransition";

type Role = "admin" | "reseller" | "premium" | "free";

interface UserRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: Role;
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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase.rpc("get_public_users");
      const merged: UserRow[] = (data ?? []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        role: (p.role ?? "free") as Role,
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
                  <motion.div
                    key={u.user_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  >
                    <GlassCard className="p-3 flex items-center gap-3">
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
                        <p className="text-[11px] text-muted-foreground truncate">{roleLabel(u.role)}</p>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border shrink-0 ${roleStyle(u.role)}`}
                      >
                        {roleLabel(u.role)}
                      </span>
                    </GlassCard>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </PageTransition>
    </AppShell>
  );
}