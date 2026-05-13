import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { toNZDate } from "@/lib/dates";

// ── Types ────────────────────────────────────────────────────

export type Preset = "today" | "yesterday" | "MTD" | "TW" | "LW" | "LM" | "3m" | "6m" | "12m" | "custom" | "pastMonth";

export interface DateRangeValue {
  /** ISO string (local midnight → UTC) for Supabase queries */
  start: string;
  /** ISO string (local 23:59:59 → UTC) for Supabase queries */
  end: string;
  /** YYYY-MM-DD in NZT for GA4 / display */
  startDate: string;
  /** YYYY-MM-DD in NZT for GA4 / display */
  endDate: string;
}

// ── Helpers ──────────────────────────────────────────────────
// All date logic is anchored to NZ time (Pacific/Auckland) regardless
// of where the user's browser is located. Operates purely on YYYY-MM-DD
// strings to avoid any local-timezone interpretation by the JS Date constructor.

/** Get today's date in NZ as YYYY-MM-DD. */
function nzToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}

/** Add (or subtract) days from a YYYY-MM-DD string. Pure string math. */
function addDays(dateStr: string, days: number): string {
  // Use UTC math on a date-only timestamp — no local timezone involvement
  const ms = Date.parse(dateStr + "T00:00:00Z") + days * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Get the day-of-week (0=Sun, 1=Mon, ..., 6=Sat) for a YYYY-MM-DD string in NZ. */
function dayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T00:00:00Z").getUTCDay();
}

/** Returns NZ year/month/day from a YYYY-MM-DD string. */
function parts(dateStr: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}

/** Format YYYY-MM-DD with month/day padding. */
function fmt(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Returns the start (Sunday) of the current week in NZ + the current week's end. */
function currentWeekRange(): { startDate: string; endDate: string } {
  const today = nzToday();
  const dow = dayOfWeek(today); // 0=Sun
  const startDate = addDays(today, -dow);
  return { startDate, endDate: today };
}

/** Returns last week (Sun–Sat) in NZ. */
function lastWeekRange(): { startDate: string; endDate: string } {
  const today = nzToday();
  const dow = dayOfWeek(today); // 0=Sun
  const lastSat = addDays(today, -dow - 1);
  const lastSun = addDays(lastSat, -6);
  return { startDate: lastSun, endDate: lastSat };
}

/** Returns first day of the current NZ month, and today. */
function currentMonthRange(): { startDate: string; endDate: string } {
  const today = nzToday();
  const { y, m } = parts(today);
  return { startDate: fmt(y, m, 1), endDate: today };
}

/** Returns the start and end of the previous NZ month. */
function lastMonthRange(): { startDate: string; endDate: string } {
  const today = nzToday();
  const { y, m } = parts(today);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  // Last day of previous month: day 0 of current month
  const lastDay = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  return { startDate: fmt(prevY, prevM, 1), endDate: fmt(prevY, prevM, lastDay) };
}

/** Returns N months ago to today (NZ). */
function nMonthsRange(n: number): { startDate: string; endDate: string } {
  const today = nzToday();
  const { y, m, d } = parts(today);
  // Step the month back by n; wrap year as needed.
  const totalMonths = y * 12 + (m - 1) - n;
  const startY = Math.floor(totalMonths / 12);
  const startM = (totalMonths % 12) + 1;
  // Clamp day to the last day of the resulting month (e.g. May 31 - 1 month → Apr 30).
  const lastDayOfStartMonth = new Date(Date.UTC(startY, startM, 0)).getUTCDate();
  const startD = Math.min(d, lastDayOfStartMonth);
  return { startDate: fmt(startY, startM, startD), endDate: today };
}

/** Convert preset → NZ date strings (single source of truth). */
export function presetToRange(preset: Exclude<Preset, "custom">): { startDate: string; endDate: string } {
  if (preset === "today") {
    const t = nzToday();
    return { startDate: t, endDate: t };
  }
  if (preset === "yesterday") {
    const y = addDays(nzToday(), -1);
    return { startDate: y, endDate: y };
  }
  if (preset === "MTD") return currentMonthRange();
  if (preset === "TW") return currentWeekRange();
  if (preset === "LW") return lastWeekRange();
  if (preset === "LM") return lastMonthRange();
  if (preset === "6m") return nMonthsRange(6);
  if (preset === "12m") return nMonthsRange(12);
  return nMonthsRange(3);
}

/** Build the full DateRangeValue from NZ date strings. */
function buildRange(startDate: string, endDate: string): DateRangeValue {
  return {
    start: startDate + "T00:00:00Z",
    end: endDate + "T23:59:59Z",
    startDate,
    endDate,
  };
}

/**
 * Backward-compat wrapper for the calendar picker which provides Date objects.
 * Converts the picked Dates to NZ date strings.
 */
export function rangeToStrings(from: Date, to: Date): DateRangeValue {
  return buildRange(toNZDate(from), toNZDate(to));
}

function fmtDateLabel(d: Date): string {
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" });
}

// ── Component ────────────────────────────────────────────────

interface Props {
  defaultPreset?: Preset;
  onChange: (range: DateRangeValue) => void;
  /** When true, hide presets that don't make sense for monthly-granular data
   *  (Today/Yesterday/This Week/Last Week). Use for views backed by Xero P&L. */
  monthOnly?: boolean;
}

/** Build a YYYY-MM-DD range covering the full given month (1st → last day). */
function pastMonthRange(yyyymm: string): { startDate: string; endDate: string } | null {
  const m = yyyymm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { startDate: fmt(year, month, 1), endDate: fmt(year, month, lastDay) };
}

/** "2026-04" → "Apr 26" */
function pastMonthLabel(yyyymm: string): string {
  const m = yyyymm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return yyyymm;
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[Number(m[2]) - 1]} ${m[1].slice(2)}`;
}

/** Generate the N most recent past months as YYYY-MM, excluding the current. */
function recentPastMonths(count: number): string[] {
  const today = nzToday();
  const { y, m } = parts(today);
  const out: string[] = [];
  for (let i = 1; i <= count; i++) {
    const totalMonths = y * 12 + (m - 1) - i;
    const yy = Math.floor(totalMonths / 12);
    const mm = (totalMonths % 12) + 1;
    out.push(`${yy}-${String(mm).padStart(2, "0")}`);
  }
  return out;
}

export function DateRangePicker({ defaultPreset = "TW", onChange, monthOnly = false }: Props) {
  const [preset, setPreset] = useState<Preset>(defaultPreset);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [monthsOpen, setMonthsOpen] = useState(false);
  const [monthsPopoverPos, setMonthsPopoverPos] = useState<{ top: number; right: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const thisMonthButtonRef = useRef<HTMLButtonElement>(null);
  const pastMonths = useMemo(() => recentPastMonths(18), []);

  // Compute popover position relative to viewport whenever it opens.
  useEffect(() => {
    if (!monthsOpen || !thisMonthButtonRef.current) return;
    const rect = thisMonthButtonRef.current.getBoundingClientRect();
    // Right-aligned with the button, same width as the button, just below it.
    setMonthsPopoverPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
      width: rect.width,
    });
  }, [monthsOpen]);

  const monthsPopoverRef = useRef<HTMLDivElement>(null);
  // Close popovers on outside click (counts portal-rendered popover too)
  useEffect(() => {
    if (!open && !monthsOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideRoot = ref.current?.contains(target);
      const insidePopover = monthsPopoverRef.current?.contains(target);
      if (!insideRoot && !insidePopover) {
        setOpen(false);
        setMonthsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, monthsOpen]);

  // Compute and emit range on any change — skip when custom is selected but no dates picked yet
  const range = useMemo(() => {
    if (preset === "custom") {
      if (customRange?.from && customRange?.to) {
        return rangeToStrings(customRange.from, customRange.to);
      }
      return null; // Don't emit until both dates are selected
    }
    if (preset === "pastMonth" && pickedMonth) {
      const r = pastMonthRange(pickedMonth);
      if (!r) return null;
      return { start: r.startDate + "T00:00:00Z", end: r.endDate + "T23:59:59Z", ...r };
    }
    const { startDate, endDate } = presetToRange(preset as Exclude<Preset, "custom" | "pastMonth">);
    return {
      start: startDate + "T00:00:00Z",
      end: endDate + "T23:59:59Z",
      startDate,
      endDate,
    };
  }, [preset, customRange, pickedMonth]);

  useEffect(() => {
    if (range) onChange(range);
  }, [range]);

  const customLabel = useMemo(() => {
    if (customRange?.from && customRange?.to) {
      return `${fmtDateLabel(customRange.from)} – ${fmtDateLabel(customRange.to)}`;
    }
    if (customRange?.from) return `${fmtDateLabel(customRange.from)} – …`;
    return "Custom range";
  }, [customRange]);

  const allPresets: { id: Preset; label: string }[] = [
    { id: "today",     label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "TW",        label: "This Week" },
    { id: "LW",        label: "Last Week" },
    // "MTD" / "This Month" is rendered as a special button-with-dropdown below
    { id: "LM",  label: "Last Month" },
    { id: "3m",  label: "3 Months" },
    { id: "6m",  label: "6 Months" },
    { id: "12m", label: "12 Months" },
  ];
  // In monthOnly mode, hide presets shorter than a month.
  const presets = monthOnly
    ? allPresets.filter((p) => ["LM", "3m", "6m", "12m"].includes(p.id))
    : allPresets;

  // When monthOnly mode is enabled while a hidden preset is active, reset to "This Month".
  useEffect(() => {
    if (!monthOnly) return;
    const hiddenInMonthOnly: Preset[] = ["today", "yesterday", "TW", "LW", "custom"];
    if (hiddenInMonthOnly.includes(preset)) setPreset("MTD");
  }, [monthOnly, preset]);

  const thisMonthActive = preset === "MTD" || preset === "pastMonth";
  const thisMonthLabel = preset === "pastMonth" && pickedMonth ? pastMonthLabel(pickedMonth) : "This Month";

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-0.5 bg-black/5 dark:bg-black/30 backdrop-blur-sm rounded-full p-1 ring-1 ring-black/10 dark:ring-white/10">
        {presets.filter((p) => ["today", "yesterday", "TW", "LW"].includes(p.id)).map((p) => (
          <button
            key={p.id}
            onClick={() => { setPreset(p.id); setOpen(false); setMonthsOpen(false); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
              preset === p.id
                ? "bg-black/10 dark:bg-white/15 text-foreground shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {p.label}
          </button>
        ))}

        {/* This Month — clickable preset + chevron opens past-months dropdown */}
        <div className="relative">
          <button
            ref={thisMonthButtonRef}
            onClick={() => {
              // First click selects current month; subsequent click toggles dropdown
              if (!thisMonthActive) {
                setPreset("MTD");
                setPickedMonth(null);
                setOpen(false);
              } else {
                setMonthsOpen((o) => !o);
              }
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
              thisMonthActive
                ? "bg-black/10 dark:bg-white/15 text-foreground shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {thisMonthLabel}
            <ChevronDown className={`h-3 w-3 transition-transform ${monthsOpen ? "rotate-180" : ""}`} />
          </button>
          {monthsOpen && monthsPopoverPos && createPortal(
            <div
              ref={monthsPopoverRef}
              style={{
                position: "fixed",
                top: monthsPopoverPos.top,
                right: monthsPopoverPos.right,
                width: monthsPopoverPos.width,
              }}
              className="z-[9999] max-h-72 overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 ring-1 ring-black/20 dark:ring-white/20 shadow-2xl py-1">
              <button
                type="button"
                onClick={() => { setPreset("MTD"); setPickedMonth(null); setMonthsOpen(false); }}
                className={`w-full text-center px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  preset === "MTD"
                    ? "bg-black/[0.06] dark:bg-white/[0.08] text-foreground"
                    : "text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                }`}
              >
                This Month
              </button>
              {pastMonths.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setPreset("pastMonth"); setPickedMonth(m); setMonthsOpen(false); }}
                  className={`w-full text-center px-3 py-1.5 text-[11px] font-medium transition-colors ${
                    preset === "pastMonth" && pickedMonth === m
                      ? "bg-black/[0.06] dark:bg-white/[0.08] text-foreground"
                      : "text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  }`}
                >
                  {pastMonthLabel(m)}
                </button>
              ))}
            </div>,
            document.body,
          )}
        </div>

        {presets.filter((p) => ["LM", "3m", "6m", "12m"].includes(p.id)).map((p) => (
          <button
            key={p.id}
            onClick={() => { setPreset(p.id); setOpen(false); setMonthsOpen(false); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
              preset === p.id
                ? "bg-black/10 dark:bg-white/15 text-foreground shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {p.label}
          </button>
        ))}

        {!monthOnly && (
          <button
            onClick={() => { setPreset("custom"); setOpen((o) => !o); }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
              preset === "custom"
                ? "bg-black/10 dark:bg-white/15 text-foreground shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {preset === "custom" ? customLabel : "Custom"}
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {open && !monthOnly && (
        <div className="absolute right-0 top-full mt-2 z-[100] bg-card border border-border rounded-xl shadow-xl p-3">
          <Calendar
            mode="range"
            selected={customRange}
            onSelect={(r) => {
              setCustomRange(r);
              if (r?.from && r?.to) setOpen(false);
            }}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
            defaultMonth={customRange?.from ?? new Date()}
          />
        </div>
      )}
    </div>
  );
}

