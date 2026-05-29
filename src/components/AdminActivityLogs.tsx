import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, RefreshCw, Trash2, History, User, Mail, Lock, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LogRow {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  action: string;
  detail: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

const actionMeta: Record<string, { label: string; icon: any; color: string }> = {
  update_username: { label: "Ubah Username", icon: User, color: "text-blue-400" },
  update_email: { label: "Ubah Email", icon: Mail, color: "text-amber-400" },
  update_password: { label: "Ubah Password", icon: Lock, color: "text-rose-400" },
  update_avatar: { label: "Ubah Foto Profil", icon: ImageIcon, color: "text-emerald-400" },
  remove_avatar: { label: "Hapus Foto Profil", icon: ImageIcon, color: "text-muted-foreground" },
};

export default function AdminActivityLogs() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [clearing, setClearing] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_user_activity_logs", { _limit: 500 });
    if (error) toast.error("Gagal memuat log: " + error.message);
    else setLogs((data as LogRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (l.full_name ?? "").toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      (l.detail ?? "").toLowerCase().includes(q)
    );
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("user_activity_logs").delete().eq("id", id);
    if (error) toast.error("Gagal hapus: " + error.message);
    else {
      setLogs((prev) => prev.filter((l) => l.id !== id));
      toast.success("Log dihapus");
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    const { error } = await supabase
      .from("user_activity_logs")
      .delete()
      .gte("created_at", "1970-01-01");
    setClearing(false);
    if (error) toast.error("Gagal: " + error.message);
    else {
      setLogs([]);
      toast.success("Semua log dihapus");
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Log Aktivitas Pengguna</h3>
          <span className="text-xs text-muted-foreground">({filtered.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={logs.length === 0 || clearing}
                className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Clear All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Hapus semua log?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tindakan ini akan menghapus {logs.length} catatan aktivitas dan tidak dapat dibatalkan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll} className="bg-destructive hover:bg-destructive/90">
                  Hapus Semua
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Input
        placeholder="Cari nama, email, atau jenis aksi..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input-glass"
      />

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Belum ada aktivitas tercatat.
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((log) => {
            const meta = actionMeta[log.action] ?? {
              label: log.action,
              icon: History,
              color: "text-muted-foreground",
            };
            const Icon = meta.icon;
            return (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-secondary/30 hover:bg-secondary/50 transition-colors"
              >
                {log.avatar_url ? (
                  <img
                    src={log.avatar_url}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border border-border/50 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {(log.full_name ?? log.email ?? "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {log.full_name || log.email || "User"}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">
                      {log.role}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs mt-0.5 ${meta.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span className="font-medium">{meta.label}</span>
                  </div>
                  {(log.old_value || log.new_value) && log.action !== "update_password" && log.action !== "update_avatar" && (
                    <div className="text-[11px] text-muted-foreground mt-1 truncate">
                      {log.old_value && <span className="line-through opacity-60">{log.old_value}</span>}
                      {log.old_value && log.new_value && <span className="mx-1">→</span>}
                      {log.new_value && <span className="text-foreground/80">{log.new_value}</span>}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">{formatTime(log.created_at)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(log.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}