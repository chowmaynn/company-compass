import { useState, useEffect, useCallback, useMemo } from "react";
import { type Metric, type StatusColor, type Department, scorecardMonth, getCurrentWeekIndex } from "@/data/scorecardData";
import { fetchScorecard, updateScorecardCell, type ScorecardRow } from "@/lib/supabase-scorecard";
import { calculateStatus, invertedMetrics } from "@/lib/calculateStatus";
import { useKit } from "@/hooks/use-kit";
import { useNotion } from "@/hooks/use-notion";
import { useGoogleAnalytics } from "@/hooks/use-google-analytics";
import { useBitly, type BitlyWeeklyData } from "@/hooks/use-bitly";
import { useCalendly } from "@/hooks/use-calendly";
import { useClose } from "@/hooks/use-close";

// Define display order for metrics within each department
const METRIC_ORDER: string[] = [
  // Finance
  "Revenue",
  "Cash Collected",
  // Content
  "Videos posted last week",
  "Videos in the backlog",
  "YouTube views",
  "New YouTube subscribers",
  "Clicks: YouTube > Skool",
  "Clicks: YouTube > Accelerator",
  "Clicks: Skool > Accelerator",
  "Clicks: Webinar (total)",
  // Marketing
  "Emails Sent",
  "Email Clicks",
  "Total Bookings",
  "Email Bookings",
  "Website Views",
  "Website Booking Rate",
  "Skool Joins",
  "Skool Booking Rate",
  // Sales
  "Closing Calls Booked",
  "Closing Call Show Rate",
  "Closing Calls Taken",
  "Closing Call Close Rate",
  // Product
  "Customer support complaints",
  "NPS Score - 2 months",
  "NPS Score - 6 Months",
];

function sortMetrics(metrics: Metric[]): Metric[] {
  return [...metrics].sort((a, b) => {
    const ai = METRIC_ORDER.indexOf(a.name);
    const bi = METRIC_ORDER.indexOf(b.name);
    // Unknown metrics go to the end
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

// Map Supabase status strings → app StatusColor
const STATUS_MAP: Record<string, StatusColor> = {
  "ahead": "light-green",
  "on track": "green",
  "behind": "yellow",
  "off track": "red",
};

// Reverse map for writing back
const STATUS_REVERSE: Record<StatusColor, string> = {
  "light-green": "ahead",
  "green": "on track",
  "yellow": "behind",
  "red": "off track",
};

function parseVal(s: string): number | string {
  if (!s || s === "—") return "—";
  return s;
}

function rowToMetric(row: ScorecardRow): Metric {
  return {
    name: row.metric,
    department: row.department as Department,
    catchUp: {
      actual: parseVal(row.catchup_actual),
      projection: parseVal(row.catchup_target),
    },
    weeks: [
      { actual: parseVal(row.w1_actual), projection: parseVal(row.w1_target) },
      { actual: parseVal(row.w2_actual), projection: parseVal(row.w2_target) },
      { actual: parseVal(row.w3_actual), projection: parseVal(row.w3_target) },
      { actual: parseVal(row.w4_actual), projection: parseVal(row.w4_target) },
    ],
    monthlyActual: parseVal(row.monthly_actual),
    monthlyTarget: parseVal(row.monthly_target),
    status: STATUS_MAP[row.status] || "green",
    owner: row.owner,
    source: row.source,
    description: row.description,
  };
}

// Map app field paths to Supabase column names
function fieldToColumn(field: string): string | null {
  if (field === "monthlyActual") return "monthly_actual";
  if (field === "monthlyTarget") return "monthly_target";
  if (field === "status") return "status";
  if (field.startsWith("weeks.")) {
    const parts = field.split(".");
    const weekIndex = parseInt(parts[1]);
    const subField = parts[2]; // "actual" or "projection"
    const weekNum = weekIndex + 1;
    return subField === "actual" ? `w${weekNum}_actual` : `w${weekNum}_target`;
  }
  if (field === "catchUp.actual") return "catchup_actual";
  if (field === "catchUp.projection") return "catchup_target";
  return null;
}

// Current month in YYYY-MM format
const DEFAULT_MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

// Metrics sourced from live APIs — only the current week gets overlaid
type ApiSource = {
  hook: "kit" | "notion" | "ga" | "bitly" | "calendly" | "close" | "computed";
  field: string;
};

const API_METRIC_MAP: Record<string, ApiSource> = {
  "Emails Sent":                          { hook: "kit",       field: "weeklyBroadcastCount" },
  "Email Clicks":                         { hook: "kit",       field: "weeklyBroadcastClicks" },
  "Videos posted last week":              { hook: "notion",    field: "weeklyPublished" },
  "Videos in the backlog":                { hook: "notion",    field: "backlogCount" },
  "Website Views":                        { hook: "ga",        field: "weeklyViews" },
  "Clicks: YouTube > Skool":              { hook: "bitly",     field: "yt-skool" },
  "Clicks: YouTube > Accelerator":        { hook: "bitly",     field: "yt-accelerator" },
  "Clicks: Skool > Accelerator":          { hook: "bitly",     field: "skool-accelerator" },
  "Total Bookings":                       { hook: "calendly",  field: "salesBooked" },
  "Email Bookings":                       { hook: "calendly",  field: "emailBooked" },
  "Closing Calls Booked":                 { hook: "calendly",  field: "salesBooked" },
  "Website Booking Rate":                 { hook: "computed",  field: "websiteBookingRate" },
  "Closing Call Show Rate":               { hook: "close",     field: "showRate" },
  "Closing Calls Taken":                  { hook: "close",     field: "callsAnswered" },
  "Closing Call Close Rate":              { hook: "close",     field: "winRate" },
};

/** Set of metric names that are API-sourced (read-only for current week) */
export const API_SOURCED_METRICS = new Set(Object.keys(API_METRIC_MAP));

function resolveApiValue(
  source: ApiSource,
  weekIndex: number,
  apis: {
    kit: ReturnType<typeof useKit>;
    notion: ReturnType<typeof useNotion>;
    ga: { weeklyViews: (number | "—")[] };
    bitly: { weeklyClicks: BitlyWeeklyData };
    calendly: ReturnType<typeof useCalendly>;
    close: ReturnType<typeof useClose>;
  }
): number | string | "—" {
  switch (source.hook) {
    case "kit": {
      const data = apis.kit as Record<string, (number | "—")[]>;
      return data[source.field]?.[weekIndex] ?? "—";
    }
    case "notion": {
      if (source.field === "backlogCount") return apis.notion.backlogCount;
      const data = apis.notion as Record<string, (number | "—")[]>;
      return data[source.field]?.[weekIndex] ?? "—";
    }
    case "ga":
      return apis.ga.weeklyViews[weekIndex] ?? "—";
    case "bitly":
      return apis.bitly.weeklyClicks[source.field as keyof BitlyWeeklyData]?.[weekIndex] ?? "—";
    case "calendly": {
      // Calendly returns monthly totals, not weekly — use salesBooked as the monthly actual
      const val = apis.calendly[source.field as keyof ReturnType<typeof useCalendly>];
      return typeof val === "number" ? val : "—";
    }
    case "close": {
      const val = apis.close[source.field as keyof ReturnType<typeof useClose>];
      if (typeof val === "number") {
        return val;
      }
      return "—";
    }
    case "computed": {
      if (source.field === "websiteBookingRate") {
        const views = apis.ga.weeklyViews[weekIndex];
        const bookings = apis.calendly.websiteBooked;
        if (typeof views === "number" && views > 0 && typeof bookings === "number") {
          return `${((bookings / views) * 100).toFixed(2)}%`;
        }
      }
      return "—";
    }
    default:
      return "—";
  }
}

export function useScorecard(month: string = DEFAULT_MONTH) {
  const [supabaseMetrics, setSupabaseMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // API hooks
  const kit = useKit();
  const notion = useNotion();
  const ga = useGoogleAnalytics();
  const bitly = useBitly();
  const calendly = useCalendly();
  const close = useClose();

  // Load from Supabase
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const rows = await fetchScorecard(month);
        if (cancelled) return;

        if (rows.length > 0) {
          setSupabaseMetrics(sortMetrics(rows.map(rowToMetric)));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Scorecard load error:", err);
          setError(String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [month]);

  // Merge: Supabase data + live API overlay for current week only
  const metrics = useMemo(() => {
    if (supabaseMetrics.length === 0) return supabaseMetrics;

    const cwi = getCurrentWeekIndex();
    // No overlay needed if before month or past all weeks
    if (cwi < 0 || cwi >= 4) return supabaseMetrics;

    return supabaseMetrics.map((m) => {
      const source = API_METRIC_MAP[m.name];
      if (!source) return m;

      const apiVal = resolveApiValue(source, cwi, { kit, notion, ga, bitly, calendly, close });
      if (apiVal === "—") return m;

      const updated = { ...m, weeks: [...m.weeks] };
      updated.weeks[cwi] = { ...updated.weeks[cwi], actual: apiVal };
      return updated;
    });
  }, [supabaseMetrics, kit, notion, ga.weeklyViews, bitly.weeklyClicks, calendly.salesBooked, close.wonCount, close.showRate, close.callsAnswered, close.winRate]);

  // Auto-calculate statuses from most recent week's actual vs target
  const metricsWithStatus = useMemo(() => {
    return metrics.map((m) => {
      const newStatus = calculateStatus(m.weeks, invertedMetrics.has(m.name));
      if (newStatus && newStatus !== m.status) {
        return { ...m, status: newStatus };
      }
      return m;
    });
  }, [metrics]);

  // Update a metric field locally + persist to Supabase
  const updateMetric = useCallback(
    (metricName: string, field: string, value: number | string) => {
      setSupabaseMetrics((prev) =>
        prev.map((m) => {
          if (m.name !== metricName) return m;
          const updated = { ...m };
          if (field === "monthlyActual") {
            updated.monthlyActual = value;
          } else if (field === "monthlyTarget") {
            updated.monthlyTarget = value;
          } else if (field === "status") {
            updated.status = value as StatusColor;
          } else if (field.startsWith("weeks.")) {
            const parts = field.split(".");
            const weekIndex = parseInt(parts[1]);
            const subField = parts[2] as "actual" | "projection";
            updated.weeks = updated.weeks.map((w, i) =>
              i === weekIndex ? { ...w, [subField]: value } : w
            );
          }
          return updated;
        })
      );

      // Persist to Supabase
      const column = fieldToColumn(field);
      if (column) {
        const dbValue = field === "status"
          ? STATUS_REVERSE[value as StatusColor] || String(value)
          : String(value);
        updateScorecardCell(metricName, month, column, dbValue);
      }
    },
    []
  );

  return { metrics: metricsWithStatus, setMetrics: setSupabaseMetrics, loading, error, updateMetric };
}
