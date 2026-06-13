import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { LogOut, LayoutDashboard, List, Crown, Sparkles, UserCog, Users as UsersIcon, MessageCircle, Star, Activity as ActivityIcon, LifeBuoy, Megaphone } from "lucide-react";
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
import VerifiedBadge from "@/components/VerifiedBadge";
import ThemeToggle from "@/components/ThemeToggle";
import AccentColorPicker from "@/components/AccentColorPicker";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useResellerStatus, formatResellerRemaining } from "@/hooks/useResellerStatus";
import { useUnreadCounts } from "@/hooks/useUnreadCounts";
import { Clock, Infinity as InfinityIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppSidebar() {
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const { role } = useUserRole();
  const { status: resellerStatus } = useResellerStatus();
  const unread = useUnreadCounts();
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
    { title: "Chat", url: "/chat", icon: MessageCircle, badge: unread.chat },
    { title: "Support", url: "/support", icon: LifeBuoy, badge: unread.support },
    { title: "Aktivitas", url: "/activity", icon: ActivityIcon },
    { title: "Rating & Feedback", url: "/feedback", icon: Star },
    { title: "Sewa & Beriklan", url: "/sewa-iklan", icon: Megaphone },
    ...(isAdmin
      ? [{ title: "Admin Panel", url: "/admin", icon: Crown }]
      : []),
  ] as Array<{ title: string; url: string; icon: any; badge?: number }>;

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
                <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1">
                  <span className="truncate">{username}</span>
                  <VerifiedBadge
                    role={role}
                    plan={resellerStatus?.permanent ? "perm" : (resellerStatus as any)?.plan}
                    permanent={resellerStatus?.permanent}
                    size={14}
                    showFallbackLabel={false}
                  />
                </p>
                <span
                  className={`inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-md border ${getRoleStyle()}`}
                >
                  {getRoleLabel()}
                </span>
                {resellerStatus?.is_reseller && role !== "admin" && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    {resellerStatus.permanent ? (
                      <InfinityIcon className="w-3 h-3 text-primary" />
                    ) : (
                      <Clock className={`w-3 h-3 ${(resellerStatus.days_left ?? 0) <= 2 ? "text-destructive" : "text-primary"}`} />
                    )}
                    <span className={`font-semibold ${(resellerStatus.days_left ?? 99) <= 2 && !resellerStatus.permanent ? "text-destructive" : "text-foreground"}`}>
                      {formatResellerRemaining(resellerStatus)}
                    </span>
                  </div>
                )}
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
                        <span className="relative shrink-0">
                          <item.icon className="h-4 w-4" />
                          {!!item.badge && item.badge > 0 && (
                            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar animate-pulse" />
                          )}
                        </span>
                        <span className="flex-1">{item.title}</span>
                        {!!item.badge && item.badge > 0 && (
                          <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        )}
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

          {resellerStatus?.is_reseller && !resellerStatus.permanent && role !== "admin" && (
            <>
              <SidebarSeparator />
              <div className="p-3">
                <div className={`relative overflow-hidden rounded-xl p-[1px] bg-gradient-to-br ${
                  (resellerStatus.days_left ?? 99) <= 2
                    ? "from-destructive via-amber to-destructive"
                    : "from-primary via-accent to-amber"
                }`}>
                  <div className="rounded-[11px] bg-background p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className={`w-4 h-4 ${(resellerStatus.days_left ?? 99) <= 2 ? "text-destructive" : "text-primary"}`} />
                      <p className="text-sm font-bold text-foreground">
                        {formatResellerRemaining(resellerStatus)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Perpanjang masa aktif reseller kamu sekarang.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => navigate("/upgrade")}
                      className="w-full bg-amber hover:bg-amber/90 text-background font-bold gap-2 h-8"
                    >
                      <Crown className="w-3.5 h-3.5" />
                      Perpanjang Sekarang
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