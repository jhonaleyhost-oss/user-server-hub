import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { LogOut, LayoutDashboard, List, Crown, Sparkles, UserCog, Users as UsersIcon, MessageCircle, Star, Activity as ActivityIcon, Megaphone, Tag, Bell, ShieldCheck, Rocket, ChevronDown, Settings2, UserX, WifiOff, ScrollText, ShieldAlert, Ghost, User as UserIcon, Server as ServerIcon, MessagesSquare, Gift, ExternalLink } from "lucide-react";
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
import { useNotifications } from "@/hooks/useNotifications";
import { Clock, Infinity as InfinityIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import SidebarStatusCard from "@/components/SidebarStatusCard";

const ADMIN_SUB_ITEMS = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard, end: true },
  { title: "Manajemen", url: "/admin/manage", icon: Settings2 },
  { title: "Akun Nonaktif", url: "/admin/inactive", icon: UserX },
  { title: "Panel Offline", url: "/admin/offline-panels", icon: WifiOff },
  { title: "Orphan ADP", url: "/admin/orphan-admin-panels", icon: Ghost },
  { title: "Garansi Role", url: "/admin/warranty", icon: ShieldCheck },
  { title: "Broadcast", url: "/admin/broadcast", icon: Bell },
  { title: "Promo", url: "/admin/promos", icon: Tag },
  { title: "Iklan", url: "/admin/ads", icon: Sparkles },
  { title: "Popup", url: "/admin/popup", icon: Megaphone },
  { title: "Log Aktivitas", url: "/admin/activity", icon: ScrollText },
];

const SIDEBAR_SCROLL_KEY = "sidebar:scrollTop";
const SIDEBAR_GROUPS_KEY = "sidebar:groups";

export function AppSidebar() {
  const { pathname } = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const { role } = useUserRole();
  const { status: resellerStatus } = useResellerStatus();
  const unread = useUnreadCounts();
  const { unread: unreadNotif } = useNotifications();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState<boolean>(() => pathname.startsWith("/admin"));
  const [groupsOpen, setGroupsOpen] = useState<Record<string, boolean>>(() => {
    try {
      const raw = sessionStorage.getItem(SIDEBAR_GROUPS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });
  const toggleGroup = (key: string) => {
    setGroupsOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { sessionStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const ignoreScrollSaveUntilRef = useRef(0);

  const saveSidebarScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    lastScrollTopRef.current = el.scrollTop;
    sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(el.scrollTop));
  };

  const restoreSidebarScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY) ?? lastScrollTopRef.current);
    if (!Number.isFinite(saved)) return;
    el.scrollTop = saved;
  };

  const prepareSidebarNavigation = () => {
    saveSidebarScroll();
    ignoreScrollSaveUntilRef.current = performance.now() + 1200;
  };

  // Persist sidebar scroll position across route changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    restoreSidebarScroll();
    const onScroll = () => {
      if (performance.now() < ignoreScrollSaveUntilRef.current) return;
      lastScrollTopRef.current = el.scrollTop;
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(el.scrollTop));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      saveSidebarScroll();
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  useLayoutEffect(() => {
    restoreSidebarScroll();
    const firstFrame = requestAnimationFrame(() => {
      restoreSidebarScroll();
      requestAnimationFrame(restoreSidebarScroll);
    });
    const shortDelay = window.setTimeout(restoreSidebarScroll, 80);
    const longDelay = window.setTimeout(restoreSidebarScroll, 220);
    return () => {
      cancelAnimationFrame(firstFrame);
      window.clearTimeout(shortDelay);
      window.clearTimeout(longDelay);
    };
  }, [pathname, adminOpen]);

  useEffect(() => {
    if (pathname.startsWith("/admin")) setAdminOpen(true);
  }, [pathname]);

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

  type NavItem = { title: string; url: string; icon: any; badge?: number; external?: boolean };
  type NavGroup = { key: string; label: string; icon: any; items: NavItem[] };

  const NAV_GROUPS: NavGroup[] = [
    {
      key: "layanan",
      label: "Panel & Layanan",
      icon: ServerIcon,
      items: [
        { title: "Dashboard", url: "/", icon: LayoutDashboard },
        { title: "List Panel", url: "/panels", icon: List },
        { title: "Aktivitas", url: "/activity", icon: ActivityIcon },
      ],
    },
    {
      key: "akun",
      label: "Akun & Profil",
      icon: UserIcon,
      items: [
        { title: "Profil Saya", url: "/profile", icon: UserCog },
        { title: "Pengguna", url: "/users", icon: UsersIcon },
      ],
    },
    {
      key: "komunitas",
      label: "Komunitas",
      icon: MessagesSquare,
      items: [
        { title: "Chat", url: "/chat", icon: MessageCircle, badge: unread.chat },
        { title: "Garansi Role", url: "/garansi", icon: ShieldAlert },
        { title: "Channel Telegram Resmi", url: "https://t.me/jhonaleytesti3", icon: Megaphone, external: true },
        { title: "Contact Admin Telegram 1", url: "https://t.me/jhonaleystorecs", icon: MessageCircle, external: true },
        { title: "Contact Admin Telegram 2", url: "https://t.me/jhonaleystoreid", icon: MessageCircle, external: true },
      ],
    },
    {
      key: "promo",
      label: "Promo & Sewa Iklan",
      icon: Gift,
      items: [
        { title: "Promo & Kupon", url: "/promo", icon: Tag },
        { title: "Sewa & Beriklan", url: "/sewa-iklan", icon: Megaphone },
        { title: "Notifikasi", url: "/notifikasi", icon: Bell, badge: unreadNotif },
      ],
    },
  ];

  const isGroupOpen = (g: NavGroup) => {
    if (groupsOpen[g.key] !== undefined) return groupsOpen[g.key];
    // default: open if it contains the active route
    return g.items.some((i) => pathname === i.url);
  };

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const emailPrefix = user?.email?.split("@")[0] ?? "Guest";
  const username = fullName?.trim() || emailPrefix;
  const initial = username.charAt(0).toUpperCase();

  const getRoleLabel = () => {
    switch (role) {
      case "admin":
        return "Admin";
      case "adp_server":
        return "Admin Panel";
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
      case "adp_server":
        return "bg-purple-500/15 text-purple-400 border-purple-500/30";
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
              onPointerDown={prepareSidebarNavigation}
              onClick={() => {
                prepareSidebarNavigation();
                navigate("/profile");
              }}
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

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {/* Exclusive Upgrade CTA — always visible, top of nav */}
          <div className="px-3 pt-3 pb-1">
            <NavLink
              to="/upgrade"
              onPointerDown={prepareSidebarNavigation}
              onClick={prepareSidebarNavigation}
              className={({ isActive }) =>
                `group relative block overflow-hidden rounded-xl p-[1.5px] transition-transform hover:scale-[1.015] ${
                  isActive ? "ring-2 ring-amber/60" : ""
                }`
              }
              style={{
                background:
                  "linear-gradient(120deg,hsl(var(--amber)),hsl(var(--primary)),hsl(var(--accent)),hsl(var(--amber)))",
                backgroundSize: "200% 100%",
              }}
            >
              <div className="relative rounded-[10px] bg-gradient-to-br from-background via-background to-secondary/40 px-3 py-2.5">
                <div className="pointer-events-none absolute -top-6 -right-6 w-16 h-16 rounded-full bg-amber/25 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-6 -left-6 w-16 h-16 rounded-full bg-primary/25 blur-2xl" />
                <div className="relative flex items-center gap-2.5">
                  <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-amber via-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
                    <Rocket className="w-4.5 h-4.5 text-white drop-shadow" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-black tracking-tight bg-gradient-to-r from-amber via-primary to-accent bg-clip-text text-transparent">
                        UPGRADE
                      </span>
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow">
                        PRO
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight truncate">
                      Reseller · Admin Panel · Unlimited
                    </p>
                  </div>
                  <Sparkles className="w-3.5 h-3.5 text-amber shrink-0 animate-pulse" />
                </div>
              </div>
            </NavLink>
          </div>

          {NAV_GROUPS.map((group) => {
            const open = isGroupOpen(group);
            const groupBadge = group.items.reduce((sum, i) => sum + (i.badge ?? 0), 0);
            return (
              <SidebarGroup key={group.key}>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => toggleGroup(group.key)}
                        className="flex items-center gap-3 w-full text-muted-foreground hover:text-foreground"
                      >
                        <group.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left text-xs font-bold uppercase tracking-wider">
                          {group.label}
                        </span>
                        {!open && groupBadge > 0 && (
                          <span className="min-w-[18px] h-4 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                            {groupBadge > 99 ? "99+" : groupBadge}
                          </span>
                        )}
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {open && group.items.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={item.external ? false : isActive(item.url)}>
                          {item.external ? (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 pl-6"
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span className="flex-1">{item.title}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                            </a>
                          ) : (
                            <NavLink
                              to={item.url}
                              end
                              onPointerDown={prepareSidebarNavigation}
                              onClick={prepareSidebarNavigation}
                              className="flex items-center gap-3 pl-6"
                            >
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
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/feedback")}>
                    <NavLink
                      to="/feedback"
                      end
                      onPointerDown={prepareSidebarNavigation}
                      onClick={prepareSidebarNavigation}
                      className="flex items-center gap-3"
                    >
                      <Star className="h-4 w-4 shrink-0 text-amber" />
                      <span className="flex-1 text-xs font-bold uppercase tracking-wider">
                        Rating & Feedback
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {isAdmin && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setAdminOpen((v) => !v)}
                      isActive={pathname.startsWith("/admin")}
                      className="flex items-center gap-3 w-full"
                    >
                      <Crown className="h-4 w-4 shrink-0 text-amber" />
                      <span className="flex-1 text-left text-xs font-bold uppercase tracking-wider">Admin Panel</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform ${adminOpen ? "rotate-180" : ""}`}
                      />
                    </SidebarMenuButton>
                    {adminOpen && (
                      <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border/70 flex flex-col gap-0.5">
                        {ADMIN_SUB_ITEMS.map((sub) => (
                          <NavLink
                            key={sub.url}
                            to={sub.url}
                            end={sub.end}
                            onPointerDown={prepareSidebarNavigation}
                            onClick={prepareSidebarNavigation}
                            className={({ isActive }) =>
                              `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                isActive
                                  ? "bg-primary/15 text-primary"
                                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                              }`
                            }
                          >
                            <sub.icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{sub.title}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
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
                      onPointerDown={prepareSidebarNavigation}
                      onClick={() => {
                        prepareSidebarNavigation();
                        navigate("/upgrade");
                      }}
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
                      onPointerDown={prepareSidebarNavigation}
                      onClick={() => {
                        prepareSidebarNavigation();
                        navigate("/upgrade");
                      }}
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
              <NotificationBell />
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