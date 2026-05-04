import { useState, useEffect, useCallback, useMemo } from "react";
import { type Metric, type StatusColor, type Department, generateWeekConfigs, getCurrentWeekIndex, getCompletedWeekIndex, getCurrentNZMonth } from "@/data/scorecardData";
import { fetchScorecard, updateScorecardCell, type ScorecardRow } from "@/lib/supabase-scorecard";
import { calculateStatus, invertedMetrics } from "@/lib/calculateStatus";
import { useKit } from "@/hooks/use-kit";
import { useNotion } from "@/hooks/use-notion";
import { useGoogleAnalytics } from "@/hooks/use-google-analytics";
import { useSalesTracking } from "@/hooks/use-sales-tracking";
import { useIntercom } from "@/hooks/use-intercom";
import { useTallyNps } from "@/hooks/use-tally-nps";
import { useSupabaseMetrics } from "@/hooks/use-supabase-metrics";
import { useSkoolJoins, type SkoolJoinsData } from "@/hooks/use-skool-joins";

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
  "Total Bookings",
  "Email Bookings",
  "Website Views",
  "Website Bookings",
  "Website Booking Rate",
  "Skool Joins",
  "Skool Bookings",
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
  hook: "kit" | "notion" | "ga" | "salesTracking" | "intercom" | "tally" | "computed" | "skoolJoins";
  field: string;
};

const API_METRIC_MAP: Record<string, ApiSource> = {
  "Videos posted last week":              { hook: "notion",    field: "weeklyPublished" },
  "Videos in the backlog":                { hook: "notion",    field: "backlogCount" },
  "Website Views":                        { hook: "ga",        field: "weeklyViews" },
  "Skool Joins":                          { hook: "skoolJoins", field: "weeklyJoins" },
  // Bitly clicks are written to scorecard by the bitly-daily edge function — no live overlay needed
  // Total Bookings, Email Bookings: manual entry
  "Website Booking Rate":                 { hook: "computed",  field: "websiteBookingRate" },
  "Skool Booking Rate":                   { hook: "computed",  field: "skoolBookingRate" },
  // Sales metrics from sales_tracking table
  "Closing Calls Booked":                 { hook: "salesTracking", field: "calls_booked" },
  "Closing Call Show Rate":               { hook: "salesTracking", field: "show_rate" },
  "Closing Calls Taken":                  { hook: "salesTracking", field: "calls_taken" },
  "Closing Call Close Rate":              { hook: "salesTracking", field: "close_rate" },
  // Revenue, Cash Collected: manual entry
  // Customer support complaints: manual entry
  // NPS: handled as dedicated monthly metrics below, not per-week overlay
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
    salesTracking: { weekly: import("@/hooks/use-sales-tracking").WeekMetrics[]; monthly: import("@/hooks/use-sales-tracking").WeekMetrics | null; catchUp: import("@/hooks/use-sales-tracking").WeekMetrics | null };
    salesMetrics: ReturnType<typeof useSupabaseMetrics>;
    intercom: ReturnType<typeof useIntercom>;
    tallyNps: ReturnType<typeof useTallyNps>;
    skoolJoins: SkoolJoinsData;
    currentMetrics: Metric[];
    weekConfigs: import("@/data/scorecardData").WeekConfig[];
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
    case "skoolJoins":
      return apis.skoolJoins.weeklyJoins[weekIndex] ?? "—";
    case "salesTracking": {
      const weekData = apis.salesTracking.weekly[weekIndex];
      if (!weekData) return "—";
      const field = source.field as keyof import("@/hooks/use-sales-tracking").WeekMetrics;
      const val = weekData[field];
      if (val === null) return "—";
      if (field === "show_rate" || field === "close_rate") return `${val}%`;
      return val;
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
      const wc = apis.weekConfigs[weekIndex];
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
        // Use live Skool Joins data if available, fall back to scorecard
        const liveJoins = apis.skoolJoins.weeklyJoins[weekIndex];
        let skoolJoins: number;
        if (typeof liveJoins === "number" && liveJoins > 0) {
          skoolJoins = liveJoins;
        } else {
          const sjMetric = apis.currentMetrics.find((m) => m.name === "Skool Joins");
          const raw = sjMetric?.weeks[weekIndex]?.actual;
          skoolJoins = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, ""));
        }
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
  const salesTrackingData = useSalesTracking(month);
  const stTeam = salesTrackingData.teamTotals;
  const salesTracking = useMemo(() => ({
    weekly: stTeam?.weeks ?? [],
    monthly: stTeam?.monthly ?? null,
    catchUp: stTeam?.catchUp ?? null,
  }), [stTeam]);
  const intercom = useIntercom();
  const tallyNps = useTallyNps();
  const skoolJoins = useSkoolJoins();

  // Casey's Supabase for qualified booking counts
  const [mYear, mMonth] = month.split("-").map(Number);
  const sbFrom = useMemo(() => new Date(mYear, mMonth - 1, 1).toISOString(), [mYear, mMonth]);
  const sbTo = useMemo(() => new Date(mYear, mMonth, 0, 23, 59, 59).toISOString(), [mYear, mMonth]);
  const salesMetrics = useSupabaseMetrics(sbFrom, sbTo);

  // Load from Supabase
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const rows = await fetchScorecard(month);
        if (cancelled) return;

        setSupabaseMetrics(rows.length > 0 ? sortMetrics(rows.map(rowToMetric)) : []);
      } catch (err) {
        console.error("Scorecard load error:", err);
        if (!cancelled) {
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
  const monthConfigs = useMemo(() => generateWeekConfigs(month), [month]);
  const isCurrentMonth = month === getCurrentNZMonth();

  const metrics = useMemo(() => {
    if (supabaseMetrics.length === 0) return supabaseMetrics;

    const cwi = isCurrentMonth ? getCurrentWeekIndex(monthConfigs) : monthConfigs.length;
    // Only overlay live API data when viewing the current month
    const shouldOverlayWeek = isCurrentMonth && cwi >= 0 && cwi < 4;
    // During catch-up period (cwi === -1), we're in the month but before W1
    const isCatchUp = isCurrentMonth && cwi === -1;

    const parseWeekVal = (raw: number | string): number | null => {
      if (typeof raw === "number") return raw;
      const s = String(raw).replace(/[$,]/g, "").trim();
      if (s === "—" || s === "") return null;
      const lower = s.toLowerCase();
      if (lower.endsWith("k")) { const n = parseFloat(lower); return isNaN(n) ? null : n * 1000; }
      if (lower.endsWith("m")) { const n = parseFloat(lower); return isNaN(n) ? null : n * 1000000; }
      if (lower.endsWith("%")) { const n = parseFloat(lower); return isNaN(n) ? null : n; }
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    // Metrics that should show average instead of sum
    const averagedMetrics = new Set(["Videos in the backlog", "Skool Booking Rate", "Website Booking Rate", "Closing Call Show Rate", "Closing Call Close Rate", "NPS Score - 2 months", "NPS Score - 6 Months"]);
    // Metrics where monthly is manually entered (don't auto-calculate)
    const manualMonthlyMetrics = new Set<string>([]);
    // Metrics where monthly comes from a dedicated full-range query (not sum of weeks)
    const dedicatedMonthlyMetrics = new Set<string>(["NPS Score - 2 months", "NPS Score - 6 Months"]);

    const formatSalesVal = (field: string, val: number | null): number | string | "—" => {
      if (val === null) return "—";
      if (field === "show_rate" || field === "close_rate") return `${val}%`;
      return val;
    };

    return supabaseMetrics.map((m) => {
      // Step 1: Apply API overlay
      let updated = m;
      const source = API_METRIC_MAP[m.name];

      // NPS: only overlay the live score into the active week (and catch-up).
      // Past weeks read their frozen w{N}_actual snapshot from Supabase — written
      // by the snapshot-scorecard edge function, same pattern as Bitly/Kit/Notion.
      if (m.name === "NPS Score - 2 months" || m.name === "NPS Score - 6 Months") {
        const field = m.name.includes("2") ? "2 months" : "6 months";
        const match = tallyNps.results.find((r) =>
          r.formName.toLowerCase().includes(field.toLowerCase())
        );
        if (match && !match.loading) {
          const score = match.score;
          if (shouldOverlayWeek) {
            updated = { ...m, weeks: [...m.weeks] };
            updated.weeks[cwi] = { ...updated.weeks[cwi], actual: score };
          } else if (isCatchUp) {
            updated = { ...m, catchUp: { ...m.catchUp, actual: score } };
          }
        }
      }

      // Sales tracking: overlay ALL weeks + catch-up (data comes from Supabase sales_tracking table)
      else if (source?.hook === "salesTracking") {
        const field = source.field as keyof import("@/hooks/use-sales-tracking").WeekMetrics;
        let changed = false;
        const newWeeks = [...m.weeks];

        // Overlay each week
        for (let w = 0; w < newWeeks.length; w++) {
          const weekData = salesTracking.weekly[w];
          if (weekData) {
            const val = formatSalesVal(field, weekData[field]);
            if (val !== "—") {
              newWeeks[w] = { ...newWeeks[w], actual: val };
              changed = true;
            }
          }
        }

        // Overlay catch-up
        let newCatchUp = m.catchUp;
        if (salesTracking.catchUp) {
          const cuVal = formatSalesVal(field, salesTracking.catchUp[field]);
          if (cuVal !== "—") {
            newCatchUp = { ...m.catchUp, actual: cuVal };
            changed = true;
          }
        }

        if (changed) {
          updated = { ...m, weeks: newWeeks, catchUp: newCatchUp };
        }
      } else if (shouldOverlayWeek) {
        // During an active week: overlay API data into that week's actual
        if (source) {
          const apiVal = resolveApiValue(source, cwi, { kit, notion, ga, salesTracking, intercom, tallyNps, skoolJoins, salesMetrics, currentMetrics: supabaseMetrics, weekConfigs: monthConfigs });
          if (apiVal !== "—") {
            updated = { ...m, weeks: [...m.weeks] };
            updated.weeks[cwi] = { ...updated.weeks[cwi], actual: apiVal };
          }
        }
      } else if (isCatchUp) {
        // During catch-up period: overlay snapshot metrics into catch-up actual
        if (source) {
          if (source.hook === "skoolJoins") {
            const catchUpVal = skoolJoins.catchUpJoins;
            if (catchUpVal !== "—") {
              updated = { ...m, catchUp: { ...m.catchUp, actual: catchUpVal } };
            }
          } else {
            const apiVal = resolveApiValue(source, 0, { kit, notion, ga, salesTracking, intercom, tallyNps, skoolJoins, salesMetrics, currentMetrics: supabaseMetrics, weekConfigs: monthConfigs });
            if (apiVal !== "—") {
              updated = { ...m, catchUp: { ...m.catchUp, actual: apiVal } };
            }
          }
        }
      }

      // Step 2: Auto-calculate monthly from week actuals (for all non-manual metrics)
      if (!manualMonthlyMetrics.has(m.name)) {
        if (dedicatedMonthlyMetrics.has(m.name)) {
          // NPS: set monthly from Tally NPS score (all-time, not per-week)
          if (m.name === "NPS Score - 2 months" || m.name === "NPS Score - 6 Months") {
            const field = m.name.includes("2") ? "2 months" : "6 months";
            const match = tallyNps.results.find((r) =>
              r.formName.toLowerCase().includes(field.toLowerCase())
            );
            if (match && !match.loading) {
              if (updated === m) updated = { ...m };
              updated.monthlyActual = match.score;
            }
          }
        } else {
          const weekVals = updated.weeks
            .map((w) => parseWeekVal(w.actual))
            .filter((v): v is number => v !== null);

          // Include catch-up value for summed (non-averaged) metrics
          const catchUpVal = parseWeekVal(updated.catchUp.actual);

          if (weekVals.length > 0 || catchUpVal !== null) {
            const isAvg = averagedMetrics.has(m.name);
            const weekSum = weekVals.reduce((a, b) => a + b, 0);
            let raw: number;
            if (isAvg) {
              // For averaged metrics, only average the week values (catch-up not included)
              raw = weekVals.length > 0 ? weekSum / weekVals.length : 0;
            } else {
              // For summed metrics, add catch-up to the week total
              raw = weekSum + (catchUpVal ?? 0);
            }

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
  }, [supabaseMetrics, kit, notion, ga.weeklyViews, ga.monthlyViews, salesTracking, intercom.inboxTotal, tallyNps.results, skoolJoins.weeklyJoins, skoolJoins.catchUpJoins, salesMetrics.salesEventBreakdown, salesMetrics.cube, salesMetrics.dates, monthConfigs, isCurrentMonth]);

  // Auto-calculate statuses.
  // For past/completed months: compare cumulative monthly actual vs monthly target —
  // that's what the user is mentally comparing, and it's robust to W4 having a
  // small absorbed-remainder target that makes a single week look "ahead" when
  // the month is actually behind.
  // For the current month: still use the last completed week's actual vs that
  // week's projection so the badge tracks live pace, not a partial monthly sum.
  const metricsWithStatus = useMemo(() => {
    const completedIdx = isCurrentMonth ? getCompletedWeekIndex(monthConfigs) : monthConfigs.length - 1;
    return metrics.map((m) => {
      const inverted = invertedMetrics.has(m.name);
      let newStatus: StatusColor | null = null;

      if (!isCurrentMonth) {
        // Past month: use monthly actual vs monthly target
        newStatus = calculateStatus(
          [{ actual: m.monthlyActual, projection: m.monthlyTarget }],
          inverted
        );
        // Fallback to last week if monthly values aren't parseable
        if (newStatus === null) {
          newStatus = calculateStatus([m.weeks[completedIdx]], inverted);
        }
      } else if (completedIdx >= 0) {
        // Current month, mid-flight: use the most recently completed week
        newStatus = calculateStatus([m.weeks[completedIdx]], inverted);
      } else {
        // Current month, before W1 ends — use catch-up
        newStatus = calculateStatus(
          [{ actual: m.catchUp.actual, projection: m.catchUp.projection }],
          inverted
        );
      }

      if (newStatus && newStatus !== m.status) {
        return { ...m, status: newStatus };
      }
      return m;
    });
  }, [metrics, isCurrentMonth, monthConfigs]);

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
          } else if (field === "catchUp.actual") {
            updated.catchUp = { ...updated.catchUp, actual: value };
          } else if (field === "catchUp.projection") {
            updated.catchUp = { ...updated.catchUp, projection: value };
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
    [month]
  );

  return { metrics: metricsWithStatus, setMetrics: setSupabaseMetrics, loading, error, updateMetric };
}
