import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Compass,
  ClipboardList,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSelectedMonth } from "@/components/AppLayout";
import { useScorecard } from "@/hooks/use-scorecard";
import type { StatusFilter } from "@/components/SummaryCards";

const slugToDept: Record<string, string> = {
  finance: "Finance",
  subscriptions: "Finance",
  content: "Content",
  marketing: "Marketing",
  sales: "Sales",
  "community-management": "Product",
  "evergreen-metrics": "Product",
  product: "Product",
};

const statusCards = [
  { filter: "ahead" as StatusFilter, icon: TrendingUp, color: "text-status-light-green", bg: "bg-status-light-green/10", dot: "bg-status-light-green", label: "Ahead", statusKey: "light-green" },
  { filter: "onTrack" as StatusFilter, icon: CheckCircle2, color: "text-status-green", bg: "bg-status-green/10", dot: "bg-status-green", label: "On Track", statusKey: "green" },
  { filter: "behind" as StatusFilter, icon: AlertTriangle, color: "text-status-yellow", bg: "bg-status-yellow/10", dot: "bg-status-yellow", label: "Behind", statusKey: "yellow" },
  { filter: "offTrack" as StatusFilter, icon: XCircle, color: "text-status-red", bg: "bg-status-red/10", dot: "bg-status-red", label: "Off Track", statusKey: "red" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { selectedMonth } = useSelectedMonth();
  const { metrics } = useScorecard(selectedMonth);
  const location = useLocation();
  const [openFilter, setOpenFilter] = useState<StatusFilter | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Close on route change
  useEffect(() => { setOpenFilter(null); }, [location.pathname]);

  // Close on outside click (check both sidebar and the fixed dropdown panel)
  useEffect(() => {
    if (!openFilter) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      // Check if click is inside the fixed dropdown panel
      const panel = document.querySelector("[data-status-panel]");
      if (panel?.contains(target)) return;
      setOpenFilter(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openFilter]);

  // Filter to department if on a department page
  const deptMatch = location.pathname.match(/^\/departments\/(.+)/);
  const dept = deptMatch ? slugToDept[deptMatch[1]] : null;
  const filtered = dept ? metrics.filter((m) => m.department === dept) : metrics;

  const counts = filtered.reduce(
    (acc, m) => {
      if (m.status === "light-green") acc.ahead++;
      else if (m.status === "green") acc.onTrack++;
      else if (m.status === "yellow") acc.behind++;
      else acc.offTrack++;
      return acc;
    },
    { ahead: 0, onTrack: 0, behind: 0, offTrack: 0 }
  );

  const activeCard = statusCards.find((c) => c.filter === openFilter);
  const dropdownMetrics = useMemo(() => {
    if (!openFilter) return [];
    if (openFilter === "ahead") return filtered.filter((m) => m.status === "light-green");
    if (openFilter === "onTrack") return filtered.filter((m) => m.status === "green");
    if (openFilter === "behind") return filtered.filter((m) => m.status === "yellow");
    if (openFilter === "offTrack") return filtered.filter((m) => m.status === "red");
    return [];
  }, [openFilter, filtered]);

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      <SidebarContent>
        {/* Logo */}
        <Link to="/" className="block px-4 h-[56px] flex items-center border-b border-border hover:bg-muted/50 transition-colors">
          {!collapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-primary p-1.5">
                <Compass className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-sm font-bold tracking-tight text-foreground">Dashboard</h1>
            </div>
          ) : (
            <div className="flex justify-center w-full">
              <div className="rounded-md bg-primary p-1">
                <Compass className="h-4 w-4 text-white" />
              </div>
            </div>
          )}
        </Link>

        {/* Scorecard link */}
        <Link
          to="/scorecard"
          className={`mx-2 mt-2 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
            location.pathname === "/scorecard"
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <ClipboardList className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Scorecard</span>}
        </Link>

        {/* Status metrics */}
        <div className="flex-1 flex flex-col gap-1 p-2 pt-4" ref={containerRef}>
          {statusCards.map((c) => {
            const count = counts[c.filter === "onTrack" ? "onTrack" : c.filter === "offTrack" ? "offTrack" : c.filter];
            const isActive = openFilter === c.filter;

            return (
              <div key={c.filter}>
                <button
                  ref={(el) => { buttonRefs.current[c.filter] = el; }}
                  onClick={() => setOpenFilter(isActive ? null : c.filter)}
                  className={`w-full flex flex-col items-center justify-center rounded-xl py-3 px-2 transition-all cursor-pointer ${c.bg} ${
                    isActive ? "ring-2 ring-offset-1 ring-offset-background ring-current" : "hover:scale-[1.03]"
                  } ${c.color}`}
                >
                  <span className="text-2xl font-bold">{count}</span>
                  {!collapsed && (
                    <span className="text-[9px] font-medium uppercase tracking-wider mt-0.5 text-muted-foreground">{c.label}</span>
                  )}
                </button>
              </div>
            );
          })}

          {/* Dropdown panel — fixed position, escapes sidebar overflow */}
          {openFilter && activeCard && (() => {
            const btn = buttonRefs.current[openFilter];
            const rect = btn?.getBoundingClientRect();
            const top = rect ? rect.top : 120;
            return (
              <div
                data-status-panel
                className="fixed w-[550px] max-h-[400px] bg-card rounded-xl border shadow-2xl flex flex-col overflow-hidden z-[100]"
                style={{
                  top: `${top}px`,
                  left: `calc(var(--sidebar-width) + 0.75rem)`,
                  animation: "dropDown 150ms ease-out",
                }}
              >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${activeCard.dot}`} />
                  <span className={`text-sm font-semibold ${activeCard.color}`}>{activeCard.label}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {dropdownMetrics.length} KPI{dropdownMetrics.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_90px_80px_70px] gap-2 px-4 py-2 bg-muted/20 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span>KPI</span>
                <span className="text-right">Actual</span>
                <span className="text-right">Target</span>
                <span className="text-center">Owner</span>
              </div>
              <div className="overflow-y-auto flex-1">
                {dropdownMetrics.map((m) => (
                  <div key={m.name} className="grid grid-cols-[1fr_90px_80px_70px] gap-2 px-4 py-2.5 items-center border-b border-border/30 hover:bg-muted/10 transition-colors last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                      {dept ? null : <p className="text-[10px] text-muted-foreground">{m.department}</p>}
                    </div>
                    <span className="text-sm font-semibold text-foreground text-right font-mono">{String(m.monthlyActual)}</span>
                    <span className="text-xs text-muted-foreground text-right font-mono">{String(m.monthlyTarget)}</span>
                    <span className="text-[10px] text-muted-foreground text-center truncate">{m.owner?.split(" ")[0] || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
            );
          })()}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
