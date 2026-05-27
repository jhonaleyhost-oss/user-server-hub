import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { LogOut, LayoutDashboard, List, Crown, Sparkles, UserCog, Users as UsersIcon, MessageCircle } from "lucide-react";
import {
  Sidebar,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import AccentColorPicker from "@/components/AccentColorPicker";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppSidebar() {
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const { role } = useUserRole();
  const navigate = useNavigate();

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

  const items = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "List Panel", url: "/panels", icon: List },
    { title: "Profil Saya", url: "/profile", icon: UserCog },
    { title: "Pengguna", url: "/users", icon: UsersIcon },
    { title: "Chat", url: "/chat", icon: MessageCircle },
    ...(isAdmin
      ? [{ title: "Admin Panel", url: "/admin", icon: Crown }]
      : []),
  ];

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const emailPrefix = user?.email?.split("@")[0] ?? "Guest";
  const username = fullName?.trim() || emailPrefix;
  const initial = username.charAt(0).toUpperCase();

  const getRoleLabel = () => {
    switch (role) {
      case "admin":
        return "Admin";
      case "reseller":
        return "Reseller";
      case "premium":
        return "Premium";
      default:
        return "Free";
    }
  };

  const getRoleStyle = () => {
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

  return (
    <Sidebar collapsible="offcanvas">
      <div className="flex h-svh min-h-0 flex-1 flex-col overflow-hidden md:h-full">
        <div>
          <div className="p-3 pt-4">
            <button
              onClick={() => navigate("/profile")}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/60 border border-border/50 transition-colors text-left"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className="w-10 h-10 rounded-full object-cover shadow-md shrink-0"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white text-base shadow-md shrink-0">
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{username}</p>
                <span
                  className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md border ${getRoleStyle()}`}
                >
                  {getRoleLabel()}
                </span>
              </div>
            </button>
          </div>

          <SidebarSeparator />

        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <SidebarGroup>
            <SidebarGroupLabel>Navigasi</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url} end className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </div>

        <div className="shrink-0 bg-sidebar">
          {role === "free" && (
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
                      onClick={() => navigate("/upgrade")}
                      className="w-full bg-amber hover:bg-amber/90 text-background font-bold gap-2 h-8"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Lihat Detail
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="p-3 border-t border-sidebar-border bg-sidebar">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="flex-1 h-10 gap-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
              <ThemeToggle />
              <AccentColorPicker />
            </div>

            <div className="flex items-center justify-center pt-1">
              <Logo size="sm" />
            </div>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}

export default AppSidebar;