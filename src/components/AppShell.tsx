import { ReactNode, useEffect, useState } from "react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useResellerStatus } from "@/hooks/useResellerStatus";
import VerifiedBadge from "@/components/VerifiedBadge";

const HamburgerTrigger = () => {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleSidebar}
      className="ml-3 h-11 w-11 rounded-full bg-secondary/50 hover:bg-secondary border border-sidebar-border shadow-sm"
      aria-label="Toggle Sidebar"
    >
      <Menu className="h-5 w-5" strokeWidth={2.5} />
    </Button>
  );
};

const HeaderProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = useUserRole();
  const { status: resellerStatus } = useResellerStatus();
  const { openMobile, open, isMobile } = useSidebar();
  const sidebarOpen = isMobile ? openMobile : open;
  const [fullName, setFullName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = () => {
      supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setFullName(data?.full_name ?? null);
          setAvatarUrl(data?.avatar_url ?? null);
        });
    };
    load();
    const onUpdate = () => load();
    window.addEventListener("profile:updated", onUpdate);
    return () => window.removeEventListener("profile:updated", onUpdate);
  }, [user]);

  if (!user) return null;

  const emailPrefix = user.email?.split("@")[0] ?? "Guest";
  const username = fullName?.trim() || emailPrefix;
  const initial = username.charAt(0).toUpperCase();

  return (
    <button
      onClick={() => navigate("/profile")}
      className={`mr-3 flex items-center gap-2 pl-3 pr-1 h-11 rounded-full bg-secondary/50 hover:bg-secondary border border-sidebar-border transition-all duration-300 ease-in-out ${
        sidebarOpen
          ? "translate-x-[120%] opacity-0 pointer-events-none"
          : "translate-x-0 opacity-100"
      }`}
      aria-label="Buka profil"
      aria-hidden={sidebarOpen}
      tabIndex={sidebarOpen ? -1 : 0}
    >
      <div className="flex flex-col items-end gap-0.5 leading-none min-w-0">
        <div className="flex items-center gap-1 max-w-[140px]">
          <span className="text-xs font-semibold text-foreground truncate">
            {username}
          </span>
          <VerifiedBadge
            role={role}
            permanent={resellerStatus?.permanent}
            plan={
              resellerStatus?.permanent
                ? "perm"
                : undefined
            }
            size={14}
            showFallbackLabel={false}
          />
        </div>
      </div>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className="w-9 h-9 rounded-full object-cover shrink-0"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initial}
        </div>
      )}
    </button>
  );
};

interface AppShellProps {
  children: ReactNode;
}

const AppShell = ({ children }: AppShellProps) => {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex md:hidden items-center justify-between border-b border-sidebar-border bg-background/70 backdrop-blur sticky top-0 z-30">
            <HamburgerTrigger />
            <HeaderProfile />
          </header>
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AppShell;