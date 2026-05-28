import { cn } from "@/lib/utils";

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
export type BadgeRole = "admin" | "reseller" | "premium" | "free" | string;
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

/** Pick the tier key for a given (role, plan, permanent) combo. */
function pickTier(role: BadgeRole, plan: BadgePlan, permanent?: boolean | null) {
  if (role === "admin") return TIERS.admin;
  if (role === "reseller") {
    if (permanent || plan === "perm") return TIERS.perm;
    if (plan === "2bln") return TIERS["2bln"];
    return TIERS["1bln"];
  }
  return null;
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

  if (tier) {
    return (
      <span
        className={cn("inline-flex items-center", className)}
        title={tier.label}
        aria-label={tier.label}
      >
        <VerifiedSVG tier={tier} size={size} />
      </span>
    );
  }

  if (!showFallbackLabel) return null;

  const fb = FALLBACK_LABEL[role as string] ?? FALLBACK_LABEL.free;
  return (
    <span
      className={cn(
        "text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border",
        fb.cls,
        className,
      )}
    >
      {fb.text}
    </span>
  );
};

export default VerifiedBadge;