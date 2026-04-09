import { useQuery } from "@tanstack/react-query";
import { PUBLIC_SALES_EVENTS } from "@/lib/constants";

const BASE = "/api/supabase";

interface RawMetricRow {
  metric_date: string;
  category: string | null;
  metric_name: string;
  value: string | number;
}

type DataCube = Record<string, Record<string, Record<string, number>>>;
const OVERALL = "__overall__";

function buildCube(rows: RawMetricRow[]): DataCube {
  const cube: DataCube = {};
  rows.forEach((row) => {
    const date = row.metric_date.substring(0, 10);
    const cat = row.category ?? OVERALL;
    if (!cube[date]) cube[date] = {};
    if (!cube[date][cat]) cube[date][cat] = {};
    cube[date][cat][row.metric_name] = Number(row.value);
  });
  return cube;
}

async function fetchDynamicMetrics(from: string, to: string): Promise<RawMetricRow[]> {
  // Use execute_sql to get full output including source-level data
  // (direct RPC call to get_dynamic_metrics drops source_ rows due to NULL join paths)
  const res = await fetch(`${BASE}/rest/v1/rpc/execute_sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql_query: `SELECT * FROM get_dynamic_metrics('${from}', '${to}')` }),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

export interface DailyBooking {
  date: string;
  bookings: number;
  qualified: number;
  held: number;
}

export interface EventBreakdown {
  name: string;
  qualified: number;
}

// All sales events (including non-public, for full chart visibility)
const SALES_EVENTS = [
  ...PUBLIC_SALES_EVENTS,
  "AAA Accelerator Business Call (Google)",
  "AAA Accelerator Business Call (Phone)",
];

const FOLLOWUP_EVENTS = [
  "AAA Accelerator Follow-up (Callum Crees)",
  "AAA Accelerator Follow-up (Harry Hawkes)",
  "AAA Accelerator Follow-up (Jamie Patterson)",
  "AAA Accelerator Follow-up (Joel Price)",
  "AAA Accelerator Follow-up (Kevin Taheryan)",
  "AAA Accelerator Follow-up (Kornelius Van Heek)",
  "AAA Accelerator Follow-up (Richard Mach)",
];

export function useSupabaseMetrics(from: string, to: string) {
  const query = useQuery({
    queryKey: ["supabase", "metrics", from, to],
    queryFn: () => fetchDynamicMetrics(from, to),
    staleTime: 5 * 60 * 1000,
  });

  const rows: RawMetricRow[] = query.data ?? [];
  const cube = buildCube(rows);
  const dates = Object.keys(cube).sort();

  // ── Source-level bookings (qualified = total_bookings - casey_cancelled) ───
  // Uses source_ categories from get_dynamic_metrics which match the Google Sheet calculation.
  const SOURCE_DISPLAY_NAMES: Record<string, string> = {
    "source_website": "Website",
    "source_website b": "Website B",
    "source_website c": "Website C",
    "source_skool setter": "Skool A",
    "source_skool classroom": "Skool C",
    "source_skool post": "Skool P",
    "source_email general": "Email",
    "source_email welcome": "Welcome Email",
    "source_masterclass": "Masterclass",
    "source_google": "Google",
    "source_aios lp": "AIOS LP",
  };

  const sourceQualified: Record<string, number> = {};
  const allSourceCategories = new Set<string>();
  dates.forEach((date) => {
    Object.keys(cube[date] || {}).forEach((cat) => {
      if (cat.startsWith("source_")) allSourceCategories.add(cat);
    });
  });

  allSourceCategories.forEach((sourceCat) => {
    let totalBk = 0, caseyCx = 0;
    dates.forEach((date) => {
      totalBk += cube[date]?.[sourceCat]?.total_bookings ?? 0;
      caseyCx += cube[date]?.[sourceCat]?.casey_cancelled ?? 0;
    });
    const displayName = SOURCE_DISPLAY_NAMES[sourceCat] || sourceCat.replace("source_", "");
    sourceQualified[displayName] = totalBk - caseyCx;
  });

  // Fallback: if source_google or source_aios_lp have no data, use event-level qualified
  const EVENT_FALLBACKS: { displayName: string; eventName: string }[] = [
    { displayName: "Google", eventName: "AAA Accelerator Business Call (Google)" },
    { displayName: "AIOS LP", eventName: "AAA Accelerator Business Call (Masterclass)" },
  ];
  for (const { displayName, eventName } of EVENT_FALLBACKS) {
    if (!sourceQualified[displayName] || sourceQualified[displayName] === 0) {
      let q = 0;
      dates.forEach((date) => { q += cube[date]?.[`event_${eventName}`]?.qualified ?? 0; });
      if (q > 0) sourceQualified[displayName] = q;
    }
  }

  const totalBookings = Object.values(sourceQualified).reduce((s, v) => s + v, 0);

  // ── Overall funnel metrics (null category — all call types) ──────────
  // Used for cancellation and show-rate context. Labels clarify this scope.
  let allHeld = 0, caseyCancel = 0, inviteeCancel = 0, otherCancel = 0, allBookings = 0;
  dates.forEach((date) => {
    const o = cube[date]?.[OVERALL] ?? {};
    allBookings   += o.total_bookings       ?? 0;
    allHeld       += o.held                 ?? 0;
    caseyCancel   += o.casey_cancelled      ?? 0;
    inviteeCancel += o.invitee_cancelled    ?? 0;
    otherCancel   += o.other_host_cancelled ?? 0;
  });

  // ── Funnel rates — computed from OVERALL only (consistent numerator/denominator) ──
  // allQualified = all event types minus country disqualifications
  const allQualified = allBookings - caseyCancel;
  const totalCancelled = caseyCancel + inviteeCancel + otherCancel;
  const noShows = Math.max(0, allQualified - allHeld - inviteeCancel);
  // Show rate: held ÷ allQualified (both from OVERALL — same population)
  const showRate = allQualified > 0 ? Math.round((allHeld / allQualified) * 100) : null;
  const noShowRate = allQualified > 0 ? Math.round((noShows / allQualified) * 100) : null;
  const cancellationRate = allBookings > 0 ? Math.round((inviteeCancel / allBookings) * 100) : null;
  const totalQualified = totalBookings; // scoped to public events for KPI display
  const totalHeld = allHeld;

  // ── Daily booking trend (source-level qualified) ─────────
  const dailyBookings: DailyBooking[] = dates.map((date) => {
    let bookings = 0;
    allSourceCategories.forEach((sourceCat) => {
      const totalBk = cube[date]?.[sourceCat]?.total_bookings ?? 0;
      const caseyCx = cube[date]?.[sourceCat]?.casey_cancelled ?? 0;
      bookings += totalBk - caseyCx;
    });
    const o = cube[date]?.[OVERALL] ?? {};
    return { date, bookings, qualified: bookings, held: o.held ?? 0 };
  });

  // ── Sales event breakdown (source-level qualified for chart) ────────────
  const salesEventBreakdown: EventBreakdown[] = Object.entries(sourceQualified)
    .map(([name, qualified]) => ({ name, qualified }))
    .filter((e) => e.qualified > 0)
    .sort((a, b) => b.qualified - a.qualified);

  // ── Follow-up breakdown ───────────────────────────────
  const followupBreakdown: EventBreakdown[] = FOLLOWUP_EVENTS.map((name) => {
    let qualified = 0;
    dates.forEach((date) => { qualified += cube[date]?.[`event_${name}`]?.qualified ?? 0; });
    const firstName = name.match(/\(([^)]+)\)/)?.[1]?.split(" ")[0] ?? name;
    return { name: firstName, qualified };
  }).filter((e) => e.qualified > 0).sort((a, b) => b.qualified - a.qualified);

  const followupTotal = followupBreakdown.reduce((s, e) => s + e.qualified, 0);

  return {
    totalBookings,
    totalQualified,
    totalHeld,
    totalCancelled,
    caseyCancel,
    inviteeCancel,
    otherCancel,
    noShows,
    showRate,
    noShowRate,
    cancellationRate,
    dailyBookings,
    salesEventBreakdown,
    followupBreakdown,
    followupTotal,
    /** Raw daily data cube — use for slicing by arbitrary date ranges */
    cube,
    /** Sorted date strings present in the cube */
    dates,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
