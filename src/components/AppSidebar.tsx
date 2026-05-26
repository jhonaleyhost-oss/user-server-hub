import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, List, Crown, LogOut } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import Logo from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  const items = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "List Panel", url: "/panels", icon: List },
    ...(isAdmin ? [{ title: "Admin Panel", url: "/admin", icon: Crown }] : []),
  ];

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-3">
        {!collapsed && <Logo />}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink to={item.url} end className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Logout" className="text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;