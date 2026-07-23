import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Activity as ActivityIcon, Server, UserPlus, Crown, Megaphone, RefreshCcw } from "lucide-react";
import AppShell from "@/components/AppShell";
import { PageTransition } from "@/components/PageTransition";
import GlassCard from "@/components/GlassCard";
import { Button } from "@/components/ui/button";

const TABS = [
  { to: "/activity/panel", label: "Panel", icon: Server, gradient: "from-primary to-accent" },
  { to: "/activity/signup", label: "Pendaftar", icon: UserPlus, gradient: "from-primary to-accent" },
  { to: "/activity/upgrade", label: "Upgrade", icon: Crown, gradient: "from-amber to-primary" },
  { to: "/activity/ads", label: "Iklan", icon: Megaphone, gradient: "from-primary to-rose-500" },
];

interface Props {
  title: string;
  description: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: ReactNode;
}

export const ActivityLayout = ({ title, description, onRefresh, refreshing, children }: Props) => (
  <AppShell>
    <PageTransition>
      <div className="p-3 sm:p-4 max-w-4xl mx-auto">
        <GlassCard className="!rounded-3xl p-4 mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
              <ActivityIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground truncate">{title}</h1>
              <p className="text-xs text-muted-foreground truncate">{description}</p>
            </div>
          </div>
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={refreshing}
              className="h-10 w-10 rounded-full shrink-0"
              aria-label="Refresh"
            >
              <RefreshCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          )}
        </GlassCard>

        <GlassCard className="!rounded-full p-1 mb-3 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex-1 h-9 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap px-3 ${
                  isActive
                    ? `bg-gradient-to-r ${t.gradient} text-white shadow`
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </NavLink>
          ))}
        </GlassCard>

        {children}
      </div>
    </PageTransition>
  </AppShell>
);

export default ActivityLayout;