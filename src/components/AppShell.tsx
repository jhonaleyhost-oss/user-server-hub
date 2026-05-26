import { ReactNode, useEffect, useState } from "react";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

const HamburgerTrigger = () => {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleSidebar}
      className="ml-3 h-10 w-10 rounded-lg bg-secondary/60 hover:bg-secondary border-border/60 shadow-sm"
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

  const roleLabel =
    role === "admin"
      ? "Admin"
      : role === "reseller"
      ? "Reseller"
      : role === "premium"
      ? "Premium"
      : "Free";

  const roleStyle =
    role === "admin"
      ? "bg-amber/15 text-amber border-amber/30"
      : role === "reseller"
      ? "bg-primary/15 text-primary border-primary/30"
      : role === "premium"
      ? "bg-accent/15 text-accent border-accent/30"
      : "bg-secondary text-muted-foreground border-border";

  return (
    <button
      onClick={() => navigate("/profile")}
      className="mr-3 flex items-center gap-2.5 pl-2.5 pr-3 h-10 rounded-full bg-secondary/50 hover:bg-secondary border border-border/60 transition-colors"
      aria-label="Buka profil"
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className="w-7 h-7 rounded-full object-cover shrink-0"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      ) : (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-xs font-bold shrink-0">
          {initial}
        </div>
      )}
      <div className="flex flex-col items-start leading-tight min-w-0">
        <span className="text-xs font-semibold text-foreground truncate max-w-[110px]">
          {username}
        </span>
        <span
          className={`text-[9px] font-bold uppercase tracking-wide px-1.5 rounded border ${roleStyle} mt-0.5`}
        >
          {roleLabel}
        </span>
      </div>
    </button>
  );
};

interface AppShellProps {
  children: ReactNode;
}

const AppShell = ({ children }: AppShellProps) => {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-sidebar-border bg-background/70 backdrop-blur sticky top-0 z-30">
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