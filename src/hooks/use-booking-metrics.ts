import { useQuery } from "@tanstack/react-query";
import { PUBLIC_SALES_EVENTS } from "@/lib/constants";
import { useBookingSheet } from "@/hooks/use-booking-sheet";

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
  if (!Array.isArray(rows)) return cube;
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
  const data = await res.json();
  return Array.isArray(data) ? data : [];
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

/**
 * Booking metrics for a date range.
 *
 * Source-level booking counts (Website, Email, Welcome Email, Skool Setter /
 * Classroom / Post, Google, Masterclass, Phone) come from the Booking Google
 * Sheet via the Apps Script web app — see {@link useBookingSheet}.
 *
 * Cancellations, OVERALL funnel rates (show / no-show / cancellation), and
 * follow-up breakdowns are still derived from Calendly data in Supabase,
 * because the sheet doesn't track those.
 */
export function useBookingMetrics(from: string, to: string) {
  const query = useQuery({
    queryKey: ["booking-metrics", from, to],
    queryFn: () => fetchDynamicMetrics(from, to),
    staleTime: 5 * 60 * 1000,
  });

  const sheet = useBookingSheet();
  const useSheet = sheet.enabled;

  const rows: RawMetricRow[] = query.data ?? [];
  const cube = buildCube(rows);

  // Overlay sheet bookings on top of the Supabase cube. We only touch
  // source_* categories within the requested date range — OVERALL and
  // event_* rows are untouched, so funnel rates and follow-up breakdowns
  // still reflect Supabase.
  if (useSheet) {
    const fromDate = from.substring(0, 10);
    const toDate = to.substring(0, 10);
    const inRange = (d: string) => d >= fromDate && d <= toDate;

    for (const date of Object.keys(cube)) {
      if (!inRange(date)) continue;
      for (const cat of Object.keys(cube[date])) {
        if (cat.startsWith("source_")) delete cube[date][cat];
      }
    }
    for (const [date, sources] of Object.entries(sheet.cube)) {
      if (!inRange(date)) continue;
      if (!cube[date]) cube[date] = {};
      for (const [cat, vals] of Object.entries(sources)) {
        cube[date][cat] = { ...vals } as Record<string, number>;
      }
    }

    // OVERALL cancellation overrides — only applied for dates where the
    // sheet provides them. Sheet is silent ⇒ Supabase value wins.
    for (const [date, vals] of Object.entries(sheet.overall)) {
      if (!inRange(date)) continue;
      if (!cube[date]) cube[date] = {};
      if (!cube[date][OVERALL]) cube[date][OVERALL] = {};
      if (vals.casey_cancelled !== undefined) cube[date][OVERALL].casey_cancelled = vals.casey_cancelled;
      if (vals.invitee_cancelled !== undefined) cube[date][OVERALL].invitee_cancelled = vals.invitee_cancelled;
    }
  }

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
    "source_phone": "Phone",
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

  // Fallback: if a source has no source_ entry, use event-level qualified
  const EVENT_FALLBACKS: { displayName: string; eventName: string }[] = [
    { displayName: "Google", eventName: "AAA Accelerator Business Call (Google)" },
    { displayName: "AIOS LP", eventName: "AAA Accelerator Business Call (Masterclass)" },
    { displayName: "Skool P", eventName: "AAA Accelerator Business Call (Skool P)" },
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
