import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useSelectedMonth, useNavHover } from "@/components/AppLayout";
import { useScorecard } from "@/hooks/use-scorecard";
import type { StatusFilter } from "@/components/SummaryCards";

const statusCards = [
  { filter: "ahead" as StatusFilter, icon: TrendingUp, color: "text-status-light-green", bg: "bg-status-light-green/15", dot: "bg-status-light-green", label: "Ahead", statusKey: "light-green" },
  { filter: "onTrack" as StatusFilter, icon: CheckCircle2, color: "text-status-green", bg: "bg-status-green/15", dot: "bg-status-green", label: "On Track", statusKey: "green" },
  { filter: "behind" as StatusFilter, icon: AlertTriangle, color: "text-status-yellow", bg: "bg-status-yellow/15", dot: "bg-status-yellow", label: "Behind", statusKey: "yellow" },
  { filter: "offTrack" as StatusFilter, icon: XCircle, color: "text-status-red", bg: "bg-status-red/15", dot: "bg-status-red", label: "Off Track", statusKey: "red" },
];

export function AppSidebar() {
  const { selectedMonth } = useSelectedMonth();
  const { metrics } = useScorecard(selectedMonth);
  const { hoveredScope, hoveredRect, setHoveredScope } = useNavHover();
  const location = useLocation();
  const [openFilter, setOpenFilter] = useState<StatusFilter | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [panelLeft, setPanelLeft] = useState(0);
  const [panelTop, setPanelTop] = useState(0);
  const [pinned, setPinned] = useState(false); // Keep preview open when user hovers into it

  // Close on route change
  useEffect(() => { setOpenFilter(null); }, [location.pathname]);

  // Close KPI drilldown on outside click
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

  // Filter metrics by scope (department or global)
  const filtered = useMemo(() => {
    if (!hoveredScope || hoveredScope === "global") return metrics;
    return metrics.filter((m) => m.department === hoveredScope);
  }, [metrics, hoveredScope]);

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

  // Show the rail when a nav pill is hovered, or when the user has moved their mouse into the rail
  const show = (hoveredScope !== null || pinned);

  // Position the rail just below the hovered nav pill
  const railTop = hoveredRect ? hoveredRect.bottom + 8 : 60;
  const railLeft = hoveredRect ? hoveredRect.left : 16;

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            ref={railRef}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            onMouseEnter={() => setPinned(true)}
            onMouseLeave={() => { setPinned(false); setHoveredScope(null); }}
            style={{ top: railTop, left: railLeft }}
            className={[
              "fixed z-40",
              "flex items-center gap-1 rounded-full px-2 py-1.5",
              "bg-gradient-to-b from-white/15 to-white/5 dark:from-white/[0.08] dark:to-white/[0.02]",
              "backdrop-blur-2xl backdrop-saturate-150",
              "ring-1 ring-black/15 dark:ring-white/10",
              "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_4px_24px_-6px_rgba(0,0,0,0.3),0_1px_2px_0_rgba(0,0,0,0.1)]",
            ].join(" ")}
          >
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pl-1 pr-1">
              {hoveredScope === "global" ? "All KPIs" : hoveredScope}
            </span>
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
                      if (rect) {
                        setPanelLeft(rect.left);
                        setPanelTop(rect.bottom + 8);
                      }
                    }
                    setOpenFilter(isActive ? null : c.filter);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 h-8 rounded-full text-xs font-semibold transition-all cursor-pointer ${c.color} ${
                    isActive ? `${c.bg} ring-1 ring-current/30` : "hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                  title={`${c.label}: ${count}`}
                >
                  <span className="font-bold">{count}</span>
                  <span className="text-[10px] font-medium opacity-70">{c.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dropdown panel — drops down from the rail */}
      {openFilter && activeCard && (
        <div
          data-status-panel
          className="fixed w-[550px] max-h-[400px] bg-card rounded-xl border shadow-2xl flex flex-col overflow-hidden z-[100]"
          style={{
            top: `${panelTop}px`,
            left: `${panelLeft}px`,
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
                  {hoveredScope && hoveredScope !== "global" ? null : <p className="text-[10px] text-muted-foreground">{m.department}</p>}
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
