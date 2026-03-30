import { useState, useEffect, useCallback, useMemo } from "react";
import { type Metric, type StatusColor, type Department, scorecardMonth, getCurrentWeekIndex, weekConfigs } from "@/data/scorecardData";
import { fetchScorecard, updateScorecardCell, type ScorecardRow } from "@/lib/supabase-scorecard";
import { calculateStatus, invertedMetrics } from "@/lib/calculateStatus";
import { useKit } from "@/hooks/use-kit";
import { useNotion } from "@/hooks/use-notion";
import { useGoogleAnalytics } from "@/hooks/use-google-analytics";
import { useClose } from "@/hooks/use-close";
import { useIntercom } from "@/hooks/use-intercom";
import { useTallyNps } from "@/hooks/use-tally-nps";
import { useSupabaseMetrics } from "@/hooks/use-supabase-metrics";

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
  hook: "kit" | "notion" | "ga" | "close" | "intercom" | "tally" | "computed";
  field: string;
};

const API_METRIC_MAP: Record<string, ApiSource> = {
  "Emails Sent":                          { hook: "kit",       field: "weeklyBroadcastCount" },
  "Email Clicks":                         { hook: "kit",       field: "weeklyBroadcastClicks" },
  "Videos posted last week":              { hook: "notion",    field: "weeklyPublished" },
  "Videos in the backlog":                { hook: "notion",    field: "backlogCount" },
  "Website Views":                        { hook: "ga",        field: "weeklyViews" },
  // Bitly clicks are written to scorecard by the bitly-daily edge function — no live overlay needed
  "Total Bookings":                       { hook: "computed",  field: "totalBookings" },
  "Email Bookings":                       { hook: "computed",  field: "emailBookings" },
  // Closing Calls metrics: manual entry (Close CRM API data available on Sales page)
  "Website Booking Rate":                 { hook: "computed",  field: "websiteBookingRate" },
  "Skool Booking Rate":                   { hook: "computed",  field: "skoolBookingRate" },
  // Customer support complaints, NPS: manual entry
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
    close: ReturnType<typeof useClose>;
    salesMetrics: ReturnType<typeof useSupabaseMetrics>;
    intercom: ReturnType<typeof useIntercom>;
    tallyNps: ReturnType<typeof useTallyNps>;
    currentMetrics: Metric[];
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
    case "close": {
      const val = apis.close[source.field as keyof ReturnType<typeof useClose>];
      if (typeof val === "number") return val;
      return "—";
    }
    case "intercom": {
      // Inbox conversations = complaints count (monthly, not weekly)
      if (source.field === "inboxTotal") return apis.intercom.inboxTotal ?? "—";
      return "—";
    }
    case "tally": {
      // Match NPS form by name fragment (e.g., "2 months", "6 Months")
      const match = apis.tallyNps.results.find((r) =>
        r.formName.toLowerCase().includes(source.field.toLowerCase())
      );
      if (match && !match.loading) return match.score;
      return "—";
    }
    case "computed": {
      // Helper: sum qualified bookings from Casey's Supabase cube for a specific week and event(s)
      const wc = weekConfigs[weekIndex];
      if (!wc) return "—";
      const toNZ = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
      const weekStart = toNZ(wc.start);
      const weekEnd = toNZ(wc.end);

      const sumWeekBookings = (eventNames: string[]) => {
        let total = 0;
        for (const date of apis.salesMetrics.dates) {
          if (date >= weekStart && date < weekEnd) {
            for (const name of eventNames) {
              total += apis.salesMetrics.cube[date]?.[`event_${name}`]?.qualified ?? 0;
            }
          }
        }
        return total;
      };

      if (source.field === "totalBookings") {
        const total = sumWeekBookings([
          "AAA Accelerator Business Call (Website)",
          "AAA Accelerator Business Call (Skool A)",
          "AAA Accelerator Business Call (Skool C)",
          "AAA Accelerator Business Call (Skool P)",
          "AAA Accelerator Business Call (Welcome Email)",
          "AAA Accelerator Business Call (Email)",
          "AAA Accelerator Business Call (Masterclass)",
        ]);
        return total > 0 ? total : "—";
      }

      if (source.field === "emailBookings") {
        const total = sumWeekBookings([
          "AAA Accelerator Business Call (Email)",
          "AAA Accelerator Business Call (Welcome Email)",
        ]);
        return total > 0 ? total : "—";
      }

      if (source.field === "websiteBookingRate") {
        const views = apis.ga.weeklyViews[weekIndex];
        if (typeof views !== "number" || views <= 0) return "—";
        const bookings = sumWeekBookings(["AAA Accelerator Business Call (Website)"]);
        if (bookings > 0) {
          return `${((bookings / views) * 100).toFixed(2)}%`;
        }
      }

      if (source.field === "skoolBookingRate") {
        const sjMetric = apis.currentMetrics.find((m) => m.name === "Skool Joins");
        const raw = sjMetric?.weeks[weekIndex]?.actual;
        const skoolJoins = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
        if (!skoolJoins || isNaN(skoolJoins) || skoolJoins <= 0) return "—";
        const skoolBookings = sumWeekBookings([
          "AAA Accelerator Business Call (Skool A)",
          "AAA Accelerator Business Call (Skool C)",
          "AAA Accelerator Business Call (Skool P)",
        ]);
        if (skoolBookings > 0) {
          return `${((skoolBookings / skoolJoins) * 100).toFixed(2)}%`;
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
  const close = useClose();
  const intercom = useIntercom();
  const tallyNps = useTallyNps();

  // Casey's Supabase for qualified booking counts
  const [mYear, mMonth] = month.split("-").map(Number);
  const sbFrom = useMemo(() => new Date(mYear, mMonth - 1, 1).toISOString(), [mYear, mMonth]);
  const sbTo = useMemo(() => new Date(mYear, mMonth, 0, 23, 59, 59).toISOString(), [mYear, mMonth]);
  const salesMetrics = useSupabaseMetrics(sbFrom, sbTo);

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

    const parseWeekVal = (raw: number | string): number | null => {
      if (typeof raw === "number") return raw;
      const s = String(raw).replace(/,/g, "").trim();
      if (s === "—" || s === "") return null;
      const lower = s.toLowerCase();
      if (lower.endsWith("k")) { const n = parseFloat(lower); return isNaN(n) ? null : n * 1000; }
      if (lower.endsWith("m")) { const n = parseFloat(lower); return isNaN(n) ? null : n * 1000000; }
      if (lower.endsWith("%")) { const n = parseFloat(lower); return isNaN(n) ? null : n; }
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    // Metrics that should show average instead of sum
    const averagedMetrics = new Set(["Videos in the backlog", "Skool Booking Rate", "Closing Call Show Rate", "Closing Call Close Rate"]);
    // Metrics where monthly is computed from totals (not averaged weekly percentages)
    const ratioMetrics = new Set(["Website Booking Rate"]);
    // Metrics where monthly is manually entered (don't auto-calculate)
    const manualMonthlyMetrics = new Set(["Revenue", "Cash Collected"]);
    // Metrics where monthly comes from a dedicated full-range query (not sum of weeks)
    const dedicatedMonthlyMetrics = new Set(["Website Views"]);

    return supabaseMetrics.map((m) => {
      // Step 1: Apply API overlay for current week
      const source = API_METRIC_MAP[m.name];
      let updated = m;

      if (source) {
        const apiVal = resolveApiValue(source, cwi, { kit, notion, ga, close, intercom, tallyNps, salesMetrics, currentMetrics: supabaseMetrics });
        if (apiVal !== "—") {
          updated = { ...m, weeks: [...m.weeks] };
          updated.weeks[cwi] = { ...updated.weeks[cwi], actual: apiVal };
        }
      }

      // Step 2: Auto-calculate monthly from week actuals (for all non-manual metrics)
      if (!manualMonthlyMetrics.has(m.name)) {
        if (dedicatedMonthlyMetrics.has(m.name)) {
          // Use dedicated full-month query (avoids sum-of-weeks discrepancy)
          if (m.name === "Website Views" && typeof ga.monthlyViews === "number") {
            if (updated === m) updated = { ...m };
            updated.monthlyActual = ga.monthlyViews;
          }
        } else if (ratioMetrics.has(m.name)) {
          // Ratio metrics: compute from total numerator / total denominator
          if (m.name === "Website Booking Rate") {
            const totalViews = typeof ga.monthlyViews === "number" ? ga.monthlyViews : 0;
            const websiteEvent = salesMetrics.salesEventBreakdown.find((e) => e.name === "Website");
            const totalBookings = websiteEvent?.qualified ?? 0;
            if (totalViews > 0 && totalBookings > 0) {
              if (updated === m) updated = { ...m };
              updated.monthlyActual = `${((totalBookings / totalViews) * 100).toFixed(2)}%`;
            }
          }
        } else {
          const weekVals = updated.weeks
            .map((w) => parseWeekVal(w.actual))
            .filter((v): v is number => v !== null);

          if (weekVals.length > 0) {
            const isAvg = averagedMetrics.has(m.name);
            const raw = isAvg
              ? weekVals.reduce((a, b) => a + b, 0) / weekVals.length
              : weekVals.reduce((a, b) => a + b, 0);

            // Check if the metric uses percentage format
            const isPercent = updated.weeks.some((w) => String(w.actual).includes("%"));
            const newMonthly = isPercent ? `${raw.toFixed(2)}%` : Math.round(raw);

            if (updated === m) updated = { ...m };
            updated.monthlyActual = newMonthly;
          }
        }
      }

      return updated;
    });
  }, [supabaseMetrics, kit, notion, ga.weeklyViews, ga.monthlyViews, close.wonCount, close.showRate, close.callsAnswered, close.winRate, intercom.inboxTotal, tallyNps.results, salesMetrics.salesEventBreakdown, salesMetrics.cube, salesMetrics.dates]);

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
