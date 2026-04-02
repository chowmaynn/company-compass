import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/use-auth";
import { Outlet, useLocation, Link } from "react-router-dom";
import { isAuthorized, getAuthUrl, clearTokens } from "@/lib/youtube-auth";
import {
  LogIn, LogOut, Sun, Moon, Compass,
  LayoutDashboard, ClipboardList, DollarSign, Video, Megaphone, Phone, Users,
} from "lucide-react";
import { useState, useEffect, createContext, useContext } from "react";
import { useExchangeRate } from "@/hooks/use-exchange-rate";
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

// Nav items for the horizontal navbar
const navItems = [
  { title: "Subscriptions", url: "/departments/subscriptions", icon: DollarSign },
  { title: "Content", url: "/departments/content", icon: Video },
  { title: "Marketing", url: "/departments/marketing", icon: Megaphone },
  { title: "Sales", url: "/departments/sales", icon: Phone },
  { title: "Product", url: "/departments/community-management", icon: Users },
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

function NavLinks() {
  const location = useLocation();

  return (
    <nav className="flex items-center gap-1 bg-black/5 dark:bg-black/40 backdrop-blur-sm rounded-full px-1.5 py-1 ring-1 ring-black/10 dark:ring-white/10">
      <Link
        to="/"
        className={`rounded-full flex items-center justify-center transition-all duration-200 ${
          location.pathname === "/"
            ? "p-2 bg-black/10 dark:bg-white/20 text-foreground shadow-sm"
            : "p-1.5 text-muted-foreground hover:text-foreground"
        }`}
        title="Dashboard"
      >
        <Compass className="h-4 w-4" />
      </Link>
      {navItems.map((item) => {
        const isActive = item.end
          ? location.pathname === item.url
          : location.pathname.startsWith(item.url);
        return (
          <Link
            key={item.url}
            to={item.url}
            className={`rounded-full font-medium whitespace-nowrap transition-all duration-200 ${
              isActive
                ? "px-5 py-2 text-[14px] bg-black/10 dark:bg-white/20 text-foreground shadow-sm scale-100"
                : "px-4 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppLayout() {
  const [currency, setCurrency] = useState<"NZD" | "USD">(() =>
    (localStorage.getItem("currency") as "NZD" | "USD") || "NZD"
  );
  const { rate } = useExchangeRate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
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
      <div className="min-h-screen bg-background">
        <AppSidebar />
        <div className="pl-16 flex flex-col min-h-screen">
          <header className="sticky top-0 z-20 h-[56px] flex items-center justify-between bg-background/80 backdrop-blur-xl px-6">
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
    </StatusModalContext.Provider>
    </CurrencyContext.Provider>
    </MonthContext.Provider>
  );
}
