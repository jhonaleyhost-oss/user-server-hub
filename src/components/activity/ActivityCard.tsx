import { Server, Cpu, HardDrive, MemoryStick, UserPlus, Crown, Calendar, Wallet, Infinity as InfinityIcon, Code2, ShieldCheck, Trash2, Megaphone, CalendarX, UserMinus } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import VerifiedBadge from "@/components/VerifiedBadge";
import { FeedItem, formatSpec, formatDateTime, relativeTime } from "./types";

interface Props {
  item: FeedItem;
  planMap: Record<string, { plan: string | null; permanent: boolean }>;
}

export const ActivityCard = ({ item: a, planMap }: Props) => {
  const name = a.full_name?.trim() || "Pengguna";
  const initial = name.charAt(0).toUpperCase();
  return (
    <GlassCard className="!rounded-2xl p-3.5 sm:p-4 hover:bg-secondary/30 transition-colors">
      <div className="flex items-start gap-3">
        {a.avatar_url ? (
          <img src={a.avatar_url} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold shrink-0">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-sm font-bold text-foreground truncate max-w-[160px]">{name}</span>
            <VerifiedBadge
              role={a.role}
              plan={a.kind === "upgrade" ? a.plan : planMap[a.user_id]?.plan}
              permanent={a.kind === "upgrade" ? a.permanent : planMap[a.user_id]?.permanent}
              size={14}
            />
            <span className="text-[10px] text-muted-foreground ml-auto" title={formatDateTime(a.created_at)}>
              {relativeTime(a.created_at)}
            </span>
          </div>

          {a.kind === "panel" && (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Membuat panel <span className="font-semibold text-foreground">{a.username}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                  <Server className="w-3 h-3 text-primary" />
                  <span className="truncate max-w-[140px]">{a.server_name || a.server_domain || "Unknown"}</span>
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold ${a.panel_type === "python" ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
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
          )}

          {a.kind === "signup" && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <UserPlus className="w-3 h-3" /> Bergabung
              </span>
              <span className="text-muted-foreground">sebagai pengguna baru</span>
            </div>
          )}

          {a.kind === "admin_cleanup" && (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Membersihkan <span className="font-semibold text-rose-400">{a.count} panel offline</span>
                {" • "}<span className="font-semibold text-foreground">{a.server_name}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                  <Trash2 className="w-3 h-3" /> Cleanup
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                  <Server className="w-3 h-3 text-primary" /> {a.server_name}
                </span>
              </div>
            </>
          )}

          {a.kind === "panel_deleted" && (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Menghapus panel <span className="font-semibold text-foreground">{a.username || "-"}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                  <Trash2 className="w-3 h-3" /> Panel Dihapus
                </span>
                {a.server_name && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                    <Server className="w-3 h-3 text-primary" /> {a.server_name}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-semibold ${a.panel_type === "python" ? "bg-blue-500/10 border-blue-500/30 text-blue-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"}`}>
                  <Code2 className="w-3 h-3" />
                  {a.panel_type === "python" ? "Python" : "NodeJS"}
                </span>
              </div>
            </>
          )}

          {a.kind === "admin_panel" && (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Membuat <span className="font-semibold text-fuchsia-300">Admin Panel</span>{" "}
                <span className="font-semibold text-foreground">{a.username || "-"}</span>
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500/15 to-fuchsia-500/15 border border-fuchsia-500/40 text-fuchsia-300 font-bold">
                  <ShieldCheck className="w-3 h-3" /> Admin Panel
                </span>
                {a.server_name && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                    <Server className="w-3 h-3 text-primary" /> {a.server_name}
                  </span>
                )}
              </div>
            </>
          )}

          {a.kind === "user_deleted" && (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Akun <span className="font-semibold text-foreground">{a.email || a.full_name || "-"}</span> dihapus
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                  <UserMinus className="w-3 h-3" /> User Dihapus
                </span>
              </div>
            </>
          )}

          {a.kind === "ad" && (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                {a.event === 'ad_rental' && <>Menyewa iklan <span className="font-semibold text-foreground">"{a.title}"</span></>}
                {a.event === 'ad_expired' && <>Masa iklan <span className="font-semibold text-foreground">"{a.title}"</span> berakhir</>}
                {a.event === 'role_expired' && <>Role <span className="font-semibold text-amber">Reseller</span> berakhir, kembali ke Free</>}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {a.event === 'ad_rental' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary font-bold">
                    <Megaphone className="w-3 h-3" /> Sewa Iklan
                  </span>
                )}
                {a.event === 'ad_expired' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-bold">
                    <CalendarX className="w-3 h-3" /> Iklan Berakhir
                  </span>
                )}
                {a.event === 'role_expired' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber/10 border border-amber/30 text-amber font-bold">
                    <Crown className="w-3 h-3" /> Reseller Berakhir
                  </span>
                )}
                {a.amount ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                    <Wallet className="w-3 h-3 text-amber" /> Rp {a.amount.toLocaleString("id-ID")}
                  </span>
                ) : null}
              </div>
            </>
          )}

          {a.kind === "upgrade" && (() => {
            const isAdp = typeof a.plan === "string" && a.plan.startsWith("adp_");
            const planCore = isAdp ? a.plan.replace(/^adp_/, "") : a.plan;
            const planLabel = planCore === "perm" ? "Permanen" : planCore === "2bln" ? "2 Bulan" : "1 Bulan";
            return (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  Upgrade ke <span className="font-semibold text-amber">{isAdp ? "ADP Server" : "Reseller"}</span>
                  {" • "}<span className="font-semibold text-foreground">{planLabel}</span>
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber/10 border border-amber/30 text-amber font-bold">
                    <Wallet className="w-3 h-3" /> Rp {a.amount.toLocaleString("id-ID")}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                    <Calendar className="w-3 h-3 text-primary" /> Beli {formatDateTime(a.paid_at || a.created_at)}
                  </span>
                  {a.permanent ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber/20 to-primary/20 border border-amber/40 text-amber font-bold">
                      <InfinityIcon className="w-3 h-3" /> Permanen
                    </span>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/60 border border-border/50 text-foreground">
                        <Crown className="w-3 h-3 text-accent" /> Durasi {a.duration_days} hari
                      </span>
                      {a.expires_at && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/30 text-destructive">
                          <Calendar className="w-3 h-3" /> Expired {formatDateTime(a.expires_at)}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </GlassCard>
  );
};

export default ActivityCard;