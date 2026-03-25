import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { isAuthorized, getAuthUrl, clearTokens } from "@/lib/youtube-auth";
import { LogIn, LogOut, Sun, Moon, TrendingUp, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useState, useEffect, createContext, useContext } from "react";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
import { useScorecard } from "@/hooks/use-scorecard";
import type { StatusFilter } from "@/components/SummaryCards";

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

function NavStatusCards({ onCardClick }: { onCardClick: (f: StatusFilter) => void }) {
  const { selectedMonth } = useSelectedMonth();
  const { metrics } = useScorecard(selectedMonth);
  const counts = metrics.reduce(
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
    { filter: "ahead" as StatusFilter, count: counts.ahead, icon: TrendingUp, color: "text-status-light-green", bg: "bg-status-light-green/10 border-status-light-green/20", label: "Ahead" },
    { filter: "onTrack" as StatusFilter, count: counts.onTrack, icon: CheckCircle2, color: "text-status-green", bg: "bg-status-green/10 border-status-green/20", label: "On Track" },
    { filter: "behind" as StatusFilter, count: counts.behind, icon: AlertTriangle, color: "text-status-yellow", bg: "bg-status-yellow/10 border-status-yellow/20", label: "Behind" },
    { filter: "offTrack" as StatusFilter, count: counts.offTrack, icon: XCircle, color: "text-status-red", bg: "bg-status-red/10 border-status-red/20", label: "Off Track" },
  ];

  if (metrics.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      {cards.map((c) => (
        <button
          key={c.filter}
          onClick={() => onCardClick(c.filter)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-all hover:scale-[1.03] cursor-pointer ${c.bg}`}
        >
          <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
          <span className={`text-sm font-bold ${c.color}`}>{c.count}</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{c.label}</span>
        </button>
      ))}
    </div>
  );
}

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/scorecard": "Scorecard",
  "/departments/finance": "Subscriptions Overview",
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
  const [selectedMonth, setSelectedMonth] = useState("2026-03");

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
              <NavStatusCards onCardClick={(f) => setStatusFilter(f)} />
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
