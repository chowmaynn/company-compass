import {
  BarChart3,
  LayoutDashboard,
  ClipboardList,
  Video,
  Megaphone,
  Phone,
  Users,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Scorecard", url: "/scorecard", icon: ClipboardList },
];

const departmentItems = [
{ title: "Content", url: "/departments/content", icon: Video },
  { title: "Marketing", url: "/departments/marketing", icon: Megaphone },
  { title: "Sales", url: "/departments/sales", icon: Phone },
  { title: "Product", url: "/departments/community-management", icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-white">
      <SidebarContent>
        <div className="px-4 py-5 border-b border-border">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-primary p-1.5">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-foreground">Company Compass</h1>
                <p className="text-[10px] text-muted-foreground">Operations Hub</p>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="rounded-lg bg-primary p-1.5">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
            </div>
          )}
        </div>

        <SidebarGroup className="pt-4">
          <SidebarGroupLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-4 mb-1">Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium hover:bg-primary/10 hover:text-primary"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="pt-4">
          <SidebarGroupLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-4 mb-1">Departments</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {departmentItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      activeClassName="bg-primary/10 text-primary font-medium hover:bg-primary/10 hover:text-primary"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
