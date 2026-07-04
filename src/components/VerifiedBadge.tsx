import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Crown, Sparkles } from "lucide-react";

/**
 * VerifiedBadge — high-fidelity, social-network style verified checkmark.
 *
 * Color tiers:
 *  - admin              → orange   (founder / staff)
 *  - reseller permanent → red      (lifetime reseller)
 *  - reseller 2bln      → green    (2-month reseller)
 *  - reseller 1bln      → blue     (1-month reseller, default reseller)
 *
 * For premium / free roles we fall back to a tiny pill label so existing
 * UI keeps the same vertical rhythm.
 */
export type BadgeRole = "admin" | "adp_server" | "reseller" | "premium" | "free" | string;
export type BadgePlan = "perm" | "1bln" | "2bln" | string | null | undefined;

export interface VerifiedBadgeProps {
  role: BadgeRole;
  plan?: BadgePlan;
  permanent?: boolean | null;
  size?: number;
  /** When true (default) also renders a tiny pill for premium/free roles. */
  showFallbackLabel?: boolean;
  className?: string;
}

type Tier = {
  label: string;
  fill: string;     // burst color
  stroke: string;   // outline color (slightly darker)
  check: string;    // checkmark color
  glow: string;     // soft halo color
};

const TIERS: Record<string, Tier> = {
  admin: {
    label: "Admin Terverifikasi",
    fill: "#f59e0b",
    stroke: "#b45309",
    check: "#ffffff",
    glow: "rgba(245, 158, 11, 0.55)",
  },
  adp_server: {
    label: "Admin Panel Server",
    fill: "#a855f7",
    stroke: "#6b21a8",
    check: "#ffffff",
    glow: "rgba(168, 85, 247, 0.7)",
  },
  perm: {
    label: "Reseller Permanen",
    fill: "#ef4444",
    stroke: "#991b1b",
    check: "#ffffff",
    glow: "rgba(239, 68, 68, 0.55)",
  },
  "2bln": {
    label: "Reseller 2 Bulan",
    fill: "#10b981",
    stroke: "#065f46",
    check: "#ffffff",
    glow: "rgba(16, 185, 129, 0.5)",
  },
  "1bln": {
    label: "Reseller 1 Bulan",
    fill: "#3b82f6",
    stroke: "#1e40af",
    check: "#ffffff",
    glow: "rgba(59, 130, 246, 0.5)",
  },
};

type TierKey = "admin" | "adp_server" | "perm" | "2bln" | "1bln";

const TIER_INFO: Record<TierKey, { title: string; description: string; cta?: string }> = {
  admin: {
    title: "Badge Admin",
    description:
      "Badge eksklusif berwarna oranye khusus untuk Admin & Staff resmi Jhonaley Store. Badge ini menandakan akun terverifikasi dan dipercaya untuk mengelola sistem.",
  },
  adp_server: {
    title: "Admin Panel Server",
    description:
      "Badge super eksklusif berwarna ungu khusus untuk pemilik Admin Panel Server — role tertinggi setelah Admin. Kamu bisa membuat panel Pterodactyl root-admin lengkap dengan PLTA/PLTC di setiap server yang tersedia.",
    cta: "Kelola Admin Panel",
  },
  perm: {
    title: "Reseller Permanen",
    description:
      "Badge eksklusif berwarna merah khusus Reseller Permanen. Dapatkan akses unlimited selamanya beserta badge prestige tertinggi dengan upgrade ke paket Reseller Permanen.",
    cta: "Upgrade ke Reseller Permanen",
  },
  "2bln": {
    title: "Reseller 2 Bulan",
    description:
      "Badge eksklusif berwarna hijau khusus Reseller dengan paket 2 bulan. Nikmati semua fitur reseller selama 2 bulan penuh.",
    cta: "Upgrade ke Reseller",
  },
  "1bln": {
    title: "Reseller 1 Bulan",
    description:
      "Badge eksklusif berwarna biru khusus Reseller. Dapatkan badge ini dengan bergabung menjadi Reseller dan nikmati seluruh fitur premium.",
    cta: "Upgrade ke Reseller",
  },
};

function pickTierKey(role: BadgeRole, plan: BadgePlan, permanent?: boolean | null): TierKey | null {
  if (role === "admin") return "admin";
  if (role === "adp_server") return "adp_server";
  if (role === "reseller") {
    if (permanent || plan === "perm") return "perm";
    if (plan === "2bln") return "2bln";
    return "1bln";
  }
  return null;
}

/** Pick the tier for a given (role, plan, permanent) combo. */
function pickTier(role: BadgeRole, plan: BadgePlan, permanent?: boolean | null) {
  const key = pickTierKey(role, plan, permanent);
  return key ? TIERS[key] : null;
}

/**
 * Crisp SVG verified badge — 12-point burst + inner checkmark.
 * Scales cleanly to any pixel size (HD on retina).
 */
const VerifiedSVG = ({ tier, size }: { tier: Tier; size: number }) => {
  const id = `vb-${tier.fill.replace("#", "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ filter: `drop-shadow(0 0 4px ${tier.glow})` }}
      className="shrink-0"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tier.fill} stopOpacity="1" />
          <stop offset="100%" stopColor={tier.stroke} stopOpacity="1" />
        </linearGradient>
      </defs>
      {/* 12-point starburst — Twitter / Instagram style verified shape */}
      <path
        d="M16 1.5 18.7 4.2 22.5 3.3 24 6.9 27.8 7.7 27.7 11.6 31 13.6 29.4 17.1 31 20.6 27.7 22.6 27.8 26.5 24 27.3 22.5 30.9 18.7 30 16 32.7 13.3 30 9.5 30.9 8 27.3 4.2 26.5 4.3 22.6 1 20.6 2.6 17.1 1 13.6 4.3 11.6 4.2 7.7 8 6.9 9.5 3.3 13.3 4.2Z"
        fill={`url(#${id})`}
        stroke={tier.stroke}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      {/* Inner highlight ring for depth */}
      <path
        d="M16 5.5 17.9 7.4 20.5 6.8 21.5 9.3 24.1 9.8 24 12.5 26.2 13.9 25.1 16.3 26.2 18.7 24 20.1 24.1 22.8 21.5 23.3 20.5 25.8 17.9 25.2 16 27.1 14.1 25.2 11.5 25.8 10.5 23.3 7.9 22.8 8 20.1 5.8 18.7 6.9 16.3 5.8 13.9 8 12.5 7.9 9.8 10.5 9.3 11.5 6.8 14.1 7.4Z"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.5"
      />
      {/* Check mark */}
      <path
        d="M10.5 16.4 14.2 20 22 12.4"
        fill="none"
        stroke={tier.check}
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const FALLBACK_LABEL: Record<string, { text: string; cls: string }> = {
  premium: {
    text: "Premium",
    cls: "bg-accent/15 text-accent border-accent/30",
  },
  free: {
    text: "Free",
    cls: "bg-secondary text-muted-foreground border-border",
  },
};

const VerifiedBadge = ({
  role,
  plan,
  permanent,
  size = 16,
  showFallbackLabel = true,
  className,
}: VerifiedBadgeProps) => {
  const tier = pickTier(role, plan, permanent);
  const tierKey = pickTierKey(role, plan, permanent);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const info = tierKey ? TIER_INFO[tierKey] : null;

  if (tier) {
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          className={cn(
            "inline-flex items-center rounded-full hover:scale-110 active:scale-95 transition-transform cursor-pointer",
            className,
          )}
          title={tier.label}
          aria-label={tier.label}
        >
          <VerifiedSVG tier={tier} size={size} />
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <VerifiedSVG tier={tier} size={22} />
                <span>{info?.title ?? tier.label}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center gap-3 py-3">
                <div
                  className="rounded-full p-4"
                  style={{ background: `radial-gradient(circle, ${tier.glow} 0%, transparent 70%)` }}
                >
                  <VerifiedSVG tier={tier} size={64} />
                </div>
                <p className="text-sm font-bold text-foreground">{tier.label}</p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed text-center">
                {info?.description}
              </p>
              {info?.cta && tierKey !== "admin" && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    navigate(tierKey === "adp_server" ? "/admin-panels" : "/upgrade");
                  }}
                  className="w-full h-11 rounded-full bg-amber hover:bg-amber/90 text-background font-bold gap-2"
                >
                  <Crown className="w-4 h-4" />
                  {info.cta}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (!showFallbackLabel) return null;

  const fb = FALLBACK_LABEL[role as string] ?? FALLBACK_LABEL.free;
  const isFree = role === "free" || !FALLBACK_LABEL[role as string];
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border hover:opacity-80 transition-opacity cursor-pointer",
          fb.cls,
          className,
        )}
      >
        {fb.text}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Belum Punya Badge Eksklusif</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-3 py-3">
              <div className="w-16 h-16 rounded-full bg-secondary/60 border border-border/50 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-amber" />
              </div>
              <p className="text-sm font-bold text-foreground">Akun {fb.text}</p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed text-center">
              {isFree
                ? "Kamu belum memiliki badge verified eksklusif. Upgrade ke Reseller untuk mendapatkan badge biru (1 bulan), hijau (2 bulan), atau merah (permanen) di samping namamu."
                : "Tingkatkan akunmu ke Reseller untuk mendapatkan badge verified eksklusif berwarna biru, hijau, atau merah sesuai paket yang kamu pilih."}
            </p>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                navigate("/upgrade");
              }}
              className="w-full h-11 rounded-full bg-amber hover:bg-amber/90 text-background font-bold gap-2"
            >
              <Crown className="w-4 h-4" />
              Upgrade ke Reseller
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VerifiedBadge;