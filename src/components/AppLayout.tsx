import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { isAuthorized, getAuthUrl, clearTokens } from "@/lib/youtube-auth";
import { LogIn, LogOut, Sun, Moon, TrendingUp, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import { useScorecard } from "@/hooks/use-scorecard";
import type { StatusFilter } from "@/components/SummaryCards";
import type { Metric } from "@/data/scorecardData";

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

const slugToDept: Record<string, string> = {
  finance: "Finance",
  content: "Content",
  marketing: "Marketing",
  sales: "Sales",
  "community-management": "Product",
  "evergreen-metrics": "Product",
  product: "Product",
};

function NavStatusCards() {
  const { selectedMonth } = useSelectedMonth();
  const { metrics } = useScorecard(selectedMonth);
  const location = useLocation();
  const [openFilter, setOpenFilter] = useState<StatusFilter | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on route change
  useEffect(() => { setOpenFilter(null); }, [location.pathname]);

  // Close on outside click
  useEffect(() => {
    if (!openFilter) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenFilter(null);
      }
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

  const cards = [
    { filter: "ahead" as StatusFilter, count: counts.ahead, icon: TrendingUp, color: "text-status-light-green", bg: "bg-status-light-green/10 border-status-light-green/20", dot: "bg-status-light-green", label: "Ahead" },
    { filter: "onTrack" as StatusFilter, count: counts.onTrack, icon: CheckCircle2, color: "text-status-green", bg: "bg-status-green/10 border-status-green/20", dot: "bg-status-green", label: "On Track" },
    { filter: "behind" as StatusFilter, count: counts.behind, icon: AlertTriangle, color: "text-status-yellow", bg: "bg-status-yellow/10 border-status-yellow/20", dot: "bg-status-yellow", label: "Behind" },
    { filter: "offTrack" as StatusFilter, count: counts.offTrack, icon: XCircle, color: "text-status-red", bg: "bg-status-red/10 border-status-red/20", dot: "bg-status-red", label: "Off Track" },
  ];

  const activeCard = cards.find((c) => c.filter === openFilter);
  const dropdownMetrics = useMemo(() => {
    if (!openFilter) return [];
    if (openFilter === "ahead") return filtered.filter((m) => m.status === "light-green");
    if (openFilter === "onTrack") return filtered.filter((m) => m.status === "green");
    if (openFilter === "behind") return filtered.filter((m) => m.status === "yellow");
    if (openFilter === "offTrack") return filtered.filter((m) => m.status === "red");
    return [];
  }, [openFilter, filtered]);

  if (filtered.length === 0) return null;

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-2">
        {cards.map((c) => (
          <button
            key={c.filter}
            onClick={() => setOpenFilter(openFilter === c.filter ? null : c.filter)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-all hover:scale-[1.03] cursor-pointer ${c.bg} ${openFilter === c.filter ? "ring-2 ring-offset-1 ring-offset-background" : ""}`}
            style={openFilter === c.filter ? { ringColor: "currentColor" } : undefined}
          >
            <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
            <span className={`text-sm font-bold ${c.color}`}>{c.count}</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{c.label}</span>
          </button>
        ))}
      </div>

      {/* Dropdown panel */}
      {openFilter && activeCard && (
        <div
          className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-[600px] max-h-[400px] bg-card rounded-xl border shadow-xl flex flex-col overflow-hidden z-50"
          style={{ animation: "dropDown 150ms ease-out", transformOrigin: "top center" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${activeCard.dot}`} />
              <span className={`text-sm font-semibold ${activeCard.color}`}>{activeCard.label}</span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {dropdownMetrics.length} KPI{dropdownMetrics.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_90px_80px_70px] gap-2 px-4 py-2 bg-muted/20 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>KPI</span>
            <span className="text-right">Actual</span>
            <span className="text-right">Target</span>
            <span className="text-center">Owner</span>
          </div>

          {/* Rows */}
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
    </div>
  );
}

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/scorecard": "Scorecard",
  "/departments/finance": "Subscriptions",
  "/departments/content": "Content",
  "/departments/marketing": "Marketing",
  "/departments/sales": "Sales",
  "/departments/community-management": "Product",
  "/departments/product": "Product",
};

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

export function AppLayout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] ?? "Dashboard";
  const [currency, setCurrency] = useState<"NZD" | "USD">(() =>
    (localStorage.getItem("currency") as "NZD" | "USD") || "NZD"
  );
  const { rate } = useExchangeRate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-20 h-[76px] flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4">
            <div className="flex items-center gap-3 shrink-0">
              <SidebarTrigger />
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            </div>
            <div className="flex-1 flex justify-center">
              <NavStatusCards />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CurrencyToggle currency={currency} setCurrency={setCurrency} />
              <ThemeToggle />
              <GoogleAuthButton />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
    </StatusModalContext.Provider>
    </CurrencyContext.Provider>
    </MonthContext.Provider>
  );
}
