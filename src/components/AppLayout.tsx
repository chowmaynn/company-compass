import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { Bell, Settings } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/scorecard": "Scorecard",
  "/departments/evergreen-metrics": "Evergreen Metrics",
  "/departments/content": "Content",
  "/departments/marketing": "Marketing",
  "/departments/sales": "Sales",
  "/departments/community-management": "Community",
};

export function AppLayout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] ?? "Dashboard";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 h-14 flex items-center justify-between border-b border-border bg-white px-5 gap-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Bell className="h-4 w-4" />
              </button>
              <button className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                <Settings className="h-4 w-4" />
              </button>
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-semibold ml-1">
                CK
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
