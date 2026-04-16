import { AppSidebar } from "@/components/AppSidebar";
import { ChatWidget } from "@/components/ChatWidget";
import { useAuth } from "@/hooks/use-auth";
import { Outlet, useLocation, Link } from "react-router-dom";
import { isAuthorized, getAuthUrl, clearTokens } from "@/lib/youtube-auth";
import {
  LogIn, LogOut, Sun, Moon, Compass, ChevronDown,
  LayoutDashboard, ClipboardList, DollarSign, Video, Megaphone, Phone, Users,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";
import { useScorecard } from "@/hooks/use-scorecard";
import type { Metric } from "@/data/scorecardData";
import { AnimatePresence } from "motion/react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import type { StatusFilter } from "@/components/SummaryCards";

// --- Nav hover context (for scorecard preview) ---
// Tracks which department (or "global") the user is hovering in the navbar
// so AppSidebar can show the matching scorecard preview.
interface NavHoverCtx {
  hoveredScope: string | "global" | null;
  setHoveredScope: (s: string | "global" | null) => void;
  hoveredRect: DOMRect | null;
  setHoveredRect: (r: DOMRect | null) => void;
}
const NavHoverContext = createContext<NavHoverCtx>({
  hoveredScope: null,
  setHoveredScope: () => {},
  hoveredRect: null,
  setHoveredRect: () => {},
});
export function useNavHover() {
  return useContext(NavHoverContext);
}

// --- Month context (global) ---
interface MonthCtx {
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
}
const MonthContext = createContext<MonthCtx>({
  selectedMonth: "2026-03",
  setSelectedMonth: () => {},
});
export function useSelectedMonth() {
  return useContext(MonthContext);
}

// --- Currency context (global) ---
interface CurrencyCtx {
  currency: "NZD" | "USD";
  rate: number | null;
  convert: (nzd: number) => number;
  symbol: string;
  label: string;
}

const CurrencyContext = createContext<CurrencyCtx>({
  currency: "NZD",
  rate: null,
  convert: (n) => n,
  symbol: "$",
  label: "NZD",
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

function CurrencyToggle({ currency, setCurrency }: { currency: "NZD" | "USD"; setCurrency: (c: "NZD" | "USD") => void }) {
  return (
    <button
      onClick={() => setCurrency(currency === "NZD" ? "USD" : "NZD")}
      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
      title={`Switch to ${currency === "NZD" ? "USD" : "NZD"}`}
    >
      <span>{currency === "NZD" ? "🇳🇿" : "🇺🇸"}</span>
      <span>{currency}</span>
    </button>
  );
}

// --- Status modal context (so navbar cards can trigger Dashboard modal) ---
interface StatusModalCtx {
  activeFilter: StatusFilter | null;
  setActiveFilter: (f: StatusFilter | null) => void;
}
const StatusModalContext = createContext<StatusModalCtx>({
  activeFilter: null,
  setActiveFilter: () => {},
});
export function useStatusModal() {
  return useContext(StatusModalContext);
}

// Nav items for the horizontal navbar
const navItems = [
  { title: "Finance", url: "/departments/finance", icon: DollarSign },
  { title: "Content", url: "/departments/content", icon: Video },
  { title: "Marketing", url: "/departments/marketing", icon: Megaphone },
  { title: "Sales", url: "/departments/sales", icon: Phone },
  { title: "Product", url: "/departments/product", icon: Users },
];


function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") setDark(false);
    else if (saved === "dark") setDark(true);
  }, []);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function GoogleAuthButton() {
  const [authed, setAuthed] = useState(isAuthorized());

  if (authed) {
    return (
      <button
        onClick={() => { clearTokens(); setAuthed(false); }}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
      >
        <LogOut className="h-3.5 w-3.5" />
        Disconnect Google
      </button>
    );
  }

  return (
    <a
      href={getAuthUrl()}
      className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-all"
    >
      <LogIn className="h-3.5 w-3.5" />
      Connect Google
    </a>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button
      onClick={signOut}
      className="flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
      title="Sign out"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}

interface StatusCounts {
  ahead: number;
  onTrack: number;
  behind: number;
  offTrack: number;
}

// Three discrete nav widths so the bar animates smoothly between 3 stable sizes
// rather than growing/shrinking unpredictably based on which pill is hovered.
const NAV_WIDTH_COLLAPSED = 292;   // All icons, no text
const NAV_WIDTH_HOVERED = 410;     // One pill expanded to show its label
const NAV_WIDTH_WITH_METRICS = 660; // One pill expanded with its status counts + chevron inline

function NavLinks() {
  const location = useLocation();
  const { selectedMonth } = useSelectedMonth();
  const { metrics } = useScorecard(selectedMonth);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Compute status counts per scope (department or global)
  const countsByScope = useMemo(() => {
    const scopes: (string | "global")[] = ["global", "Finance", "Content", "Marketing", "Sales", "Product"];
    const out: Record<string, StatusCounts> = {};
    for (const scope of scopes) {
      const filtered = scope === "global" ? metrics : metrics.filter((m) => m.department === scope);
      out[scope] = filtered.reduce(
        (acc, m) => {
          if (m.status === "light-green") acc.ahead++;
          else if (m.status === "green") acc.onTrack++;
          else if (m.status === "yellow") acc.behind++;
          else acc.offTrack++;
          return acc;
        },
        { ahead: 0, onTrack: 0, behind: 0, offTrack: 0 }
      );
    }
    return out;
  }, [metrics]);

  const countsFor = (url: string): StatusCounts | null => {
    const scope = scopeForUrl(url);
    if (!scope) return null;
    return countsByScope[scope] ?? null;
  };

  // Build pill config (also includes the filtered metrics list for the dropdown)
  const metricsForUrl = (url: string) => {
    const scope = scopeForUrl(url);
    if (!scope) return null;
    return scope === "global" ? metrics : metrics.filter((m) => m.department === scope);
  };
  const pills = useMemo(() => [
    { title: "Dashboard", url: "/", icon: Compass, counts: null as StatusCounts | null, metrics: null as ReturnType<typeof metricsForUrl> },
    { title: "Scorecard", url: "/scorecard", icon: ClipboardList, counts: countsFor("/scorecard"), metrics: metricsForUrl("/scorecard") },
    ...navItems.map((item) => ({ ...item, counts: countsFor(item.url), metrics: metricsForUrl(item.url) })),
  ], [countsByScope, metrics]);

  const activeIdx = pills.findIndex((p) =>
    p.url === "/" ? location.pathname === "/" : location.pathname.startsWith(p.url)
  );
  const hasActiveWithCounts = activeIdx >= 0 && pills[activeIdx].counts !== null;
  const someonesExpanded = activeIdx >= 0 || hoveredIdx !== null;

  // Pick the target width based on state
  const targetWidth = hasActiveWithCounts
    ? NAV_WIDTH_WITH_METRICS
    : someonesExpanded
      ? NAV_WIDTH_HOVERED
      : NAV_WIDTH_COLLAPSED;

  return (
    <motion.nav
      animate={{ width: targetWidth }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className={[
        "flex items-center gap-1 rounded-full px-2 py-1.5 overflow-hidden",
        "bg-gradient-to-b from-white/15 to-white/5 dark:from-white/[0.08] dark:to-white/[0.02]",
        "backdrop-blur-2xl backdrop-saturate-150",
        "ring-1 ring-black/5 dark:ring-white/10",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_4px_24px_-6px_rgba(0,0,0,0.3),0_1px_2px_0_rgba(0,0,0,0.1)]",
      ].join(" ")}
    >
      {pills.map((p, idx) => (
        <NavPill
          key={p.url}
          title={p.title}
          url={p.url}
          icon={p.icon}
          isActive={idx === activeIdx}
          counts={p.counts}
          metrics={p.metrics}
          isHovered={idx === hoveredIdx}
          onHoverStart={() => setHoveredIdx(idx)}
          onHoverEnd={() => setHoveredIdx(null)}
        />
      ))}
    </motion.nav>
  );
}

interface NavPillProps {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  counts: StatusCounts | null;
  metrics: Metric[] | null;
  isHovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

/** Map a nav pill URL to a scorecard scope: dept name, "global", or null (no preview). */
function scopeForUrl(url: string): string | "global" | null {
  if (url === "/scorecard") return "global";
  if (url.startsWith("/departments/")) {
    const slug = url.split("/").pop();
    if (slug === "finance") return "Finance";
    if (slug === "content") return "Content";
    if (slug === "marketing") return "Marketing";
    if (slug === "sales") return "Sales";
    if (slug === "product") return "Product";
  }
  return null;
}

function NavPill({ title, url, icon: Icon, isActive, counts, metrics, isHovered, onHoverStart, onHoverEnd }: NavPillProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const expanded = isActive || isHovered;
  const showCaret = isActive && counts !== null && metrics !== null;

  useEffect(() => {
    if (dropdownOpen && linkRef.current) {
      setRect(linkRef.current.getBoundingClientRect());
    }
  }, [dropdownOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapperRef.current?.contains(t)) return;
      const panel = document.querySelector("[data-nav-metric-dropdown]");
      if (panel?.contains(t)) return;
      setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  return (
    <div ref={wrapperRef} className="relative inline-flex" onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
    <Link
      ref={linkRef}
      to={url}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
      onClick={(e) => {
        // If we're already on this page and it has metrics, toggle the dropdown instead of re-navigating
        if (isActive && counts !== null) {
          e.preventDefault();
          setDropdownOpen((o) => !o);
        }
      }}
      className={`group inline-flex items-center h-8 rounded-full overflow-hidden transition-colors duration-200 ${
        isActive
          ? "bg-black/10 dark:bg-white/20 text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10 hover:text-foreground"
      }`}
      aria-label={title}
    >
      <span className="flex items-center justify-center shrink-0 w-8 h-8">
        <Icon className="h-4 w-4" />
      </span>
      {/* Content is always rendered at full width; the nav's overflow-hidden clips
          what doesn't fit. Expanded pills fade their content in. */}
      {(() => {
        const showCounts = isActive && counts !== null;
        return (
          <motion.div
            initial={false}
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.25, ease: "easeOut", delay: expanded ? 0.1 : 0 }}
            className={`flex items-center gap-2 whitespace-nowrap ${expanded ? "pr-4" : "w-0 overflow-hidden"}`}
            aria-hidden={!expanded}
          >
            <span className="text-[12px] font-medium">{title}</span>
            {showCounts && counts && (
              <>
                <span className="flex items-center gap-2 text-[11px] font-semibold">
                  <span className="text-red-400">
                    {counts.offTrack} <span className="font-medium">Off Track</span>
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-amber-300">
                    {counts.behind} <span className="font-medium">Behind</span>
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-emerald-400">
                    {counts.onTrack} <span className="font-medium">On Track</span>
                  </span>
                  <span className="text-muted-foreground/50">·</span>
                  <span className="text-sky-400">
                    {counts.ahead} <span className="font-medium">Ahead</span>
                  </span>
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </>
            )}
          </motion.div>
        );
      })()}
    </Link>
    <AnimatePresence>
      {dropdownOpen && metrics && rect && (
        <MetricDropdown metrics={metrics} rect={rect} />
      )}
    </AnimatePresence>
  </div>
  );
}

const STATUS_GROUPS: { key: Metric["status"]; label: string; color: string; dot: string }[] = [
  { key: "red", label: "Off Track", color: "text-red-400", dot: "bg-red-400" },
  { key: "yellow", label: "Behind", color: "text-amber-300", dot: "bg-amber-300" },
  { key: "green", label: "On Track", color: "text-emerald-400", dot: "bg-emerald-400" },
  { key: "light-green", label: "Ahead", color: "text-sky-400", dot: "bg-sky-400" },
];

function MetricDropdown({ metrics, rect }: { metrics: Metric[]; rect: DOMRect }) {
  return createPortal(
    <motion.div
      data-nav-metric-dropdown
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{
        position: "fixed",
        top: rect.bottom + 8,
        left: rect.left,
        width: 480,
      }}
      className={[
        "z-[100]",
        "rounded-2xl p-4 space-y-3",
        "bg-card/90 backdrop-blur-2xl backdrop-saturate-150",
        "ring-1 ring-black/10 dark:ring-white/10",
        "shadow-[0_12px_40px_-8px_rgba(0,0,0,0.5)]",
      ].join(" ")}
    >
      {STATUS_GROUPS.map((group) => {
        const items = metrics.filter((m) => m.status === group.key);
        if (items.length === 0) return null;
        return (
          <div key={group.key}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${group.dot}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${group.color}`}>
                {group.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-0.5">
              {items.map((m) => (
                <div key={m.name} className="flex items-center justify-between gap-3 px-2 py-1 rounded hover:bg-muted/30">
                  <span className="text-xs text-foreground truncate flex-1">{m.name}</span>
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {String(m.monthlyActual)} / {String(m.monthlyTarget)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {metrics.length === 0 && (
        <p className="text-xs text-muted-foreground italic text-center py-2">No metrics for this period.</p>
      )}
    </motion.div>,
    document.body
  );
}

export function AppLayout() {
  const [currency, setCurrency] = useState<"NZD" | "USD">(() =>
    (localStorage.getItem("currency") as "NZD" | "USD") || "NZD"
  );
  const { rate } = useExchangeRate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
  const [hoveredScope, setHoveredScope] = useState<string | "global" | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    // Default to current month in NZ timezone
    const nz = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
    return nz.slice(0, 7); // "YYYY-MM"
  });

  useEffect(() => {
    localStorage.setItem("currency", currency);
  }, [currency]);

  const currencyCtx: CurrencyCtx = {
    currency,
    rate,
    convert: (nzd: number) => currency === "USD" && rate ? Math.round(nzd * rate) : nzd,
    symbol: "$",
    label: currency,
  };

  return (
    <MonthContext.Provider value={{ selectedMonth, setSelectedMonth }}>
    <CurrencyContext.Provider value={currencyCtx}>
    <StatusModalContext.Provider value={{ activeFilter: statusFilter, setActiveFilter: setStatusFilter }}>
    <NavHoverContext.Provider value={{ hoveredScope, setHoveredScope, hoveredRect, setHoveredRect }}>
      <div className="min-h-screen">
        <div className="flex flex-col min-h-screen">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-6 pt-4 pb-3">
            <div className="flex-1 flex justify-center">
              <NavLinks />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CurrencyToggle currency={currency} setCurrency={setCurrency} />
              <ThemeToggle />
              <SignOutButton />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <ChatWidget />
    </NavHoverContext.Provider>
    </StatusModalContext.Provider>
    </CurrencyContext.Provider>
    </MonthContext.Provider>
  );
}
