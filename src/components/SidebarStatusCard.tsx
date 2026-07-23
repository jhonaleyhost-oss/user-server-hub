import { useNavigate } from "react-router-dom";
import { Sparkles, Crown, Shield, Infinity as InfinityIcon, Clock, ArrowUpRight, ServerCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarSeparator } from "@/components/ui/sidebar";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import {
  useMembershipStatus,
  daysLeft,
  formatRemaining,
  formatExpiryShort,
} from "@/hooks/useMembershipStatus";

interface Props {
  onNavigate?: () => void;
}

const ROLE_META: Record<
  Exclude<AppRole, "free" | "premium" | "admin">,
  { label: string; short: string; Icon: typeof Crown; ring: string; iconColor: string; barFrom: string; barTo: string }
> = {
  reseller: {
    label: "Reseller Aktif",
    short: "Reseller",
    Icon: Crown,
    ring: "from-primary via-accent to-amber",
    iconColor: "text-amber",
    barFrom: "from-primary",
    barTo: "to-amber",
  },
  adp_server: {
    label: "Admin Panel Aktif",
    short: "Admin Panel",
    Icon: ServerCog,
    ring: "from-accent via-primary to-emerald",
    iconColor: "text-accent",
    barFrom: "from-accent",
    barTo: "to-emerald",
  },
};

function ProgressBar({ days, permanent, colorFrom, colorTo }: { days: number | null; permanent: boolean; colorFrom: string; colorTo: string }) {
  if (permanent) return null;
  const d = days ?? 0;
  const pct = Math.max(4, Math.min(100, Math.round((d / 30) * 100)));
  const danger = d <= 3;
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${danger ? "from-destructive to-amber" : `${colorFrom} ${colorTo}`} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function SidebarStatusCard({ onNavigate }: Props) {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useUserRole();
  const { status, loading } = useMembershipStatus();

  const go = (path: string) => {
    onNavigate?.();
    navigate(path);
  };

  if (roleLoading || loading) return null;

  // Admin — hide (avoid clutter for staff)
  if (role === "admin") return null;

  // FREE — upgrade CTA
  if (role === "free") {
    return (
      <>
        <SidebarSeparator />
        <div className="p-3">
          <div className="relative overflow-hidden rounded-xl p-[1px] bg-gradient-to-br from-amber via-primary to-accent">
            <div className="rounded-[11px] bg-background p-3">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-amber" />
                <p className="text-sm font-bold text-foreground">Upgrade Premium</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Unlimited RAM, CPU & akses server private.
              </p>
              <Button
                size="sm"
                onClick={() => go("/upgrade")}
                className="w-full bg-amber hover:bg-amber/90 text-background font-bold gap-2 h-8"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Lihat Detail
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // PREMIUM legacy — simple badge
  if (role === "premium") {
    return (
      <>
        <SidebarSeparator />
        <div className="p-3">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold text-foreground">Premium Aktif</p>
          </div>
        </div>
      </>
    );
  }

  // RESELLER / ADP SERVER
  const meta = ROLE_META[role as "reseller" | "adp_server"];
  const isAdp = role === "adp_server";
  const permanent = isAdp ? !!status?.adp_server_permanent : !!status?.reseller_permanent;
  const expiresAt = isAdp ? status?.adp_server_expires_at ?? null : status?.reseller_expires_at ?? null;
  const d = daysLeft(expiresAt);
  const danger = !permanent && (d ?? 99) <= 3;
  const warning = !permanent && !danger && (d ?? 99) <= 7;

  // Secondary entitlement (e.g. ADP user who also has active reseller)
  const secondary =
    !isAdp && status?.adp_server_expires_at && (daysLeft(status.adp_server_expires_at) ?? 0) > 0
      ? { label: "Admin Panel", iso: status.adp_server_expires_at, permanent: status.adp_server_permanent }
      : isAdp && status?.reseller_expires_at && (daysLeft(status.reseller_expires_at) ?? 0) > 0
      ? { label: "Reseller", iso: status.reseller_expires_at, permanent: status.reseller_permanent }
      : null;

  const ringGradient = danger
    ? "from-destructive via-amber to-destructive"
    : meta.ring;

  return (
    <>
      <SidebarSeparator />
      <div className="p-3">
        <div className={`relative overflow-hidden rounded-xl p-[1px] bg-gradient-to-br ${ringGradient} shadow-[0_0_24px_-8px_hsl(var(--primary)/0.5)]`}>
          <div className="rounded-[11px] bg-background/95 backdrop-blur-sm p-3">
            {/* Header row: role name + status pill */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`shrink-0 h-7 w-7 rounded-lg bg-gradient-to-br ${meta.ring} flex items-center justify-center`}>
                  <meta.Icon className="w-3.5 h-3.5 text-background" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold leading-none">
                    Status Akun
                  </p>
                  <p className="text-sm font-bold text-foreground truncate leading-tight mt-0.5">
                    {meta.short}
                  </p>
                </div>
              </div>
              {permanent ? (
                <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald/15 text-emerald border border-emerald/30">
                  <InfinityIcon className="w-3 h-3" /> Permanen
                </span>
              ) : (
                <span
                  className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    danger
                      ? "bg-destructive/15 text-destructive border-destructive/30"
                      : warning
                      ? "bg-amber/15 text-amber border-amber/30"
                      : "bg-primary/15 text-primary border-primary/30"
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {formatRemaining(expiresAt, false)}
                </span>
              )}
            </div>

            {/* Expiry line */}
            {!permanent && expiresAt && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Berakhir</span>
                <span className="font-semibold text-foreground">{formatExpiryShort(expiresAt)}</span>
              </div>
            )}

            <ProgressBar days={d} permanent={permanent} colorFrom={meta.barFrom} colorTo={meta.barTo} />

            {/* Secondary entitlement */}
            {secondary && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-muted/40 border border-border px-2 py-1.5 text-[11px]">
                <span className="text-muted-foreground">+ {secondary.label}</span>
                <span className="font-semibold text-foreground">
                  {secondary.permanent ? "Permanen" : formatExpiryShort(secondary.iso)}
                </span>
              </div>
            )}

            {/* CTA */}
            {!permanent && (
              <Button
                size="sm"
                onClick={() => go("/upgrade")}
                className={`w-full mt-3 h-8 gap-2 font-bold ${
                  danger
                    ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    : "bg-amber hover:bg-amber/90 text-background"
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                {danger ? "Perpanjang Sekarang" : "Perpanjang"}
                <ArrowUpRight className="w-3.5 h-3.5 ml-auto" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
