import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { toNZDate } from "@/lib/dates";

// ── Types ────────────────────────────────────────────────────

export type Preset = "today" | "yesterday" | "MTD" | "TW" | "LM" | "3m" | "custom";

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

/** Returns 3 months ago to today. */
function threeMonthsRange(): { startDate: string; endDate: string } {
  const today = nzToday();
  const { y, m, d } = parts(today);
  const startY = m <= 3 ? y - 1 : y;
  const startM = ((m - 3 + 12 - 1) % 12) + 1;
  return { startDate: fmt(startY, startM, d), endDate: today };
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
  if (preset === "LM") return lastMonthRange();
  return threeMonthsRange();
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
}

export function DateRangePicker({ defaultPreset = "TW", onChange }: Props) {
  const [preset, setPreset] = useState<Preset>(defaultPreset);
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close calendar on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Compute and emit range on any change — skip when custom is selected but no dates picked yet
  const range = useMemo(() => {
    if (preset === "custom") {
      if (customRange?.from && customRange?.to) {
        return rangeToStrings(customRange.from, customRange.to);
      }
      return null; // Don't emit until both dates are selected
    }
    const { startDate, endDate } = presetToRange(preset as Exclude<Preset, "custom">);
    return {
      start: startDate + "T00:00:00Z",
      end: endDate + "T23:59:59Z",
      startDate,
      endDate,
    };
  }, [preset, customRange]);

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

  const presets: { id: Preset; label: string }[] = [
    { id: "today",     label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "TW",        label: "This Week" },
    { id: "MTD", label: "This Month" },
    { id: "LM",  label: "Last Month" },
    { id: "3m",  label: "3 Months" },
  ];

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-0.5 bg-black/5 dark:bg-black/30 backdrop-blur-sm rounded-full p-1 ring-1 ring-black/10 dark:ring-white/10">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => { setPreset(p.id); setOpen(false); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
              preset === p.id
                ? "bg-black/10 dark:bg-white/15 text-foreground shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            {p.label}
          </button>
        ))}

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
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-card border border-border rounded-xl shadow-xl p-3">
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

