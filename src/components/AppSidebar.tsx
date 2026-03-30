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
  { filter: "ahead" as StatusFilter, icon: TrendingUp, color: "text-status-light-green", bg: "bg-status-light-green/15", dot: "bg-status-light-green", label: "Ahead", statusKey: "light-green" },
  { filter: "onTrack" as StatusFilter, icon: CheckCircle2, color: "text-status-green", bg: "bg-status-green/15", dot: "bg-status-green", label: "On Track", statusKey: "green" },
  { filter: "behind" as StatusFilter, icon: AlertTriangle, color: "text-status-yellow", bg: "bg-status-yellow/15", dot: "bg-status-yellow", label: "Behind", statusKey: "yellow" },
  { filter: "offTrack" as StatusFilter, icon: XCircle, color: "text-status-red", bg: "bg-status-red/15", dot: "bg-status-red", label: "Off Track", statusKey: "red" },
];

export function AppSidebar() {
  const { selectedMonth } = useSelectedMonth();
  const { metrics } = useScorecard(selectedMonth);
  const location = useLocation();
  const [openFilter, setOpenFilter] = useState<StatusFilter | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [panelTop, setPanelTop] = useState(200);

  // Close on route change
  useEffect(() => { setOpenFilter(null); }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!openFilter) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (railRef.current?.contains(target)) return;
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

  const isDashboard = location.pathname === "/";
  const isScorecard = location.pathname === "/scorecard";

  return (
    <>
      {/* Floating glass rail */}
      <div
        ref={railRef}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1 rounded-2xl p-2 bg-white/[0.04] backdrop-blur-2xl ring-1 ring-white/[0.15] shadow-[0_8px_40px_-4px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.08)]"
      >
        {/* Dashboard */}
        <Link
          to="/"
          className={`flex items-center justify-center h-10 w-10 rounded-xl transition-all ${
            isDashboard ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-white/10"
          }`}
          title="Dashboard"
        >
          <Compass className="h-5 w-5" />
        </Link>

        {/* Scorecard */}
        <Link
          to="/scorecard"
          className={`flex items-center justify-center h-10 w-10 rounded-xl transition-all ${
            isScorecard ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground hover:bg-white/10"
          }`}
          title="Scorecard"
        >
          <ClipboardList className="h-5 w-5" />
        </Link>

        {/* Divider */}
        <div className="w-6 h-px bg-white/10 my-1" />

        {/* Status metric buttons */}
        {statusCards.map((c) => {
          const count = counts[c.filter === "onTrack" ? "onTrack" : c.filter === "offTrack" ? "offTrack" : c.filter];
          const isActive = openFilter === c.filter;

          return (
            <button
              key={c.filter}
              ref={(el) => { buttonRefs.current[c.filter] = el; }}
              onClick={() => {
                if (!isActive) {
                  const rect = buttonRefs.current[c.filter]?.getBoundingClientRect();
                  if (rect) setPanelTop(rect.top);
                }
                setOpenFilter(isActive ? null : c.filter);
              }}
              className={`flex flex-col items-center justify-center h-10 w-10 rounded-xl text-sm font-bold transition-all cursor-pointer ${c.color} ${
                isActive ? `${c.bg} ring-2 ring-current` : "hover:bg-white/10"
              }`}
              title={`${c.label}: ${count}`}
            >
              {count}
              <span className="text-[6px] font-medium opacity-60 leading-none -mt-0.5">{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* Dropdown panel — fixed, escapes any clipping */}
      {openFilter && activeCard && (
          <div
            data-status-panel
            className="fixed w-[550px] max-h-[400px] bg-card rounded-xl border shadow-2xl flex flex-col overflow-hidden z-[100]"
            style={{
              top: `${panelTop}px`,
              left: "5.5rem",
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
      )}
    </>
  );
}
