import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import { toNZDate } from "@/lib/dates";

// ── Types ────────────────────────────────────────────────────

export type Preset = "today" | "MTD" | "TW" | "LM" | "3m" | "custom";

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

function getCurrentMonthWeek(): { from: Date; to: Date; weekNum: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStart = new Date(year, month, 1);

  const sundays: Date[] = [monthStart];
  for (let d = 1; d <= 31; d++) {
    const date = new Date(year, month, d);
    if (date.getMonth() !== month) break;
    if (date.getDay() === 0 && d > 1) sundays.push(date);
  }

  let weekIdx = sundays.length - 1;
  for (let i = 0; i < sundays.length - 1; i++) {
    if (now < sundays[i + 1]) { weekIdx = i; break; }
  }

  const weekStart = sundays[weekIdx];
  const nextSunday = weekIdx < sundays.length - 1
    ? sundays[weekIdx + 1]
    : new Date(year, month + 1, 1);
  const weekEnd = now < nextSunday ? now : new Date(nextSunday.getTime() - 1);

  return { from: weekStart, to: weekEnd, weekNum: weekIdx + 1 };
}

export function presetToRange(preset: Exclude<Preset, "custom">): { from: Date; to: Date } {
  const now = new Date();
  if (preset === "today") {
    // Use NZ date for both start and end so GA4 gets a single-day range
    const nzToday = toNZDate(now);
    const todayDate = new Date(nzToday + "T00:00:00");
    return { from: todayDate, to: todayDate };
  }
  if (preset === "MTD") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  if (preset === "TW")  { const w = getCurrentMonthWeek(); return { from: w.from, to: w.to }; }
  if (preset === "LM") {
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
    return { from: lastMonthStart, to: lastMonthEnd };
  }
  return { from: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()), to: now };
}

export function rangeToStrings(from: Date, to: Date): DateRangeValue {
  return {
    start: from.toISOString(),
    end: to.toISOString(),
    startDate: toNZDate(from),
    endDate: toNZDate(to),
  };
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
    const { from, to } = presetToRange(preset as Exclude<Preset, "custom">);
    return rangeToStrings(from, to);
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
    { id: "today", label: "Today" },
    { id: "TW",  label: "This Week" },
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

// Re-export helpers not already exported inline
export { getCurrentMonthWeek };
