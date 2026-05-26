import { NavLink, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
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
} from "@/components/ui/sidebar";
import Logo from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";

export function AppSidebar() {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  const items = [
    { title: "Dashboard", url: "/" },
    { title: "List Panel", url: "/panels" },
    ...(isAdmin ? [{ title: "Admin Panel", url: "/admin" }] : []),
  ];

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="p-3">
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end>
                      <span>{item.title}</span>
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
            <SidebarMenuButton onClick={handleLogout} className="text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default AppSidebar;