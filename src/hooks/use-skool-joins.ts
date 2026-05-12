import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { generateWeekConfigs, getCurrentNZMonth, getCatchUpRange } from "@/data/scorecardData";
import { toNZDate } from "@/lib/dates";

const SKOOL_BASE = "/api/skool-supabase";
const TABLE = "Skool%20Lead%20Logs";
const COL = "%22Created%20At%22";
const PID = "%22Project%20ID%22";
const PROJECT_ID = "recW9TFcHNzEYV7ql";

// ── NZ timezone helper ──────────────────────────────────────

/** Get the NZ offset in ms for a given month (handles DST). */
function getNZOffsetMs(year: number, month: number): number {
  const probe = new Date(`${year}-${String(month + 1).padStart(2, "0")}-01T12:00:00`);
  const nzStr = probe.toLocaleString("en-US", { timeZone: "Pacific/Auckland" });
  const utcStr = probe.toLocaleString("en-US", { timeZone: "UTC" });
  return new Date(nzStr).getTime() - new Date(utcStr).getTime();
}

/** Convert a NZ date (YYYY-MM-DD) to UTC ISO for the start of that NZ day. */
function nzDayToUtc(dateStr: string, offsetMs: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return new Date(d.getTime() - offsetMs).toISOString();
}

// ── Per-month fetcher ───────────────────────────────────────

/**
 * Fetch Skool joins for a single (year, month). Returns a map of
 * NZ-day YYYY-MM-DD → count for dates within that month only.
 *
 * Fetches in 2-day chunks with NZ-aligned UTC boundaries — Airtable returns
 * UTC timestamps, but we want NZ-day buckets.
 */
async function fetchSkoolJoinsForMonth(year: number, month: number): Promise<Record<string, number>> {
  const now = new Date();
  const mm = String(month + 1).padStart(2, "0");
  const nzOffsetMs = getNZOffsetMs(year, month);
  const result: Record<string, number> = {};
  const daysInMo = new Date(year, month + 1, 0).getDate();
  const isCurrentMo = year === now.getFullYear() && month === now.getMonth();
  const maxDay = isCurrentMo ? now.getDate() : daysInMo;

  const CHUNK_DAYS = 2;
  for (let startDay = 1; startDay <= maxDay; startDay += CHUNK_DAYS) {
    const endDay = Math.min(startDay + CHUNK_DAYS, maxDay + 1);
    const chunkStartDate = `${year}-${mm}-${String(startDay).padStart(2, "0")}`;
    const chunkEndDate = endDay > daysInMo
      ? (month === 11 ? `${year + 1}-01-01` : `${year}-${String(month + 2).padStart(2, "0")}-01`)
      : `${year}-${mm}-${String(endDay).padStart(2, "0")}`;
    const chunkStart = nzDayToUtc(chunkStartDate, nzOffsetMs);
    const chunkEnd = nzDayToUtc(chunkEndDate, nzOffsetMs);
    try {
      const res = await fetch(
        `${SKOOL_BASE}/rest/v1/${TABLE}?select=${COL}&${PID}=eq.${PROJECT_ID}&${COL}=gte.${chunkStart}&${COL}=lt.${chunkEnd}&limit=2000`
      );
      if (res.ok) {
        const rows: { "Created At": string }[] = await res.json();
        for (const row of rows) {
          const date = toNZDate(row["Created At"] ?? "");
          if (date && date.startsWith(`${year}-${mm}`)) {
            result[date] = (result[date] || 0) + 1;
          }
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  return result;
}

// ── Months spanned by a date range ──────────────────────────

interface MonthKey { year: number; month: number }

function enumerateMonths(startISO: string, endISO: string): MonthKey[] {
  if (!startISO || !endISO) return [];
  const start = startISO.substring(0, 10);
  const end = endISO.substring(0, 10);
  if (end < start) return [];
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  const out: MonthKey[] = [];
  let y = sy, m = sm; // 1-indexed
  while (y < ey || (y === ey && m <= em)) {
    out.push({ year: y, month: m - 1 });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

// ── Range-based hook (canonical) ────────────────────────────

/**
 * Skool joins per NZ day across an arbitrary date range. Returns a merged
 * day→count map and a loading flag. Past months are cached indefinitely via
 * React Query; the current month re-fetches every 5 minutes.
 *
 * Pass `startDate`/`endDate` as NZ YYYY-MM-DD strings (or full ISO — only the
 * date portion is used). Empty strings mean "not ready yet" — no fetches fire
 * and the result is an empty map.
 */
export function useSkoolJoinsByRange(startDate: string, endDate: string): {
  joinsByDate: Record<string, number>;
  loading: boolean;
} {
  const months = useMemo(() => enumerateMonths(startDate, endDate), [startDate, endDate]);
  const now = new Date();
  const currentY = now.getFullYear();
  const currentM = now.getMonth();

  const queries = useQueries({
    queries: months.map(({ year, month }) => {
      const isCurrent = year === currentY && month === currentM;
      const isFuture = year > currentY || (year === currentY && month > currentM);
      return {
        queryKey: ["skool-joins", year, month],
        queryFn: () => fetchSkoolJoinsForMonth(year, month),
        // Past months never change → cache forever. Current month → 5 min.
        staleTime: isCurrent ? 5 * 60 * 1000 : Infinity,
        gcTime: Infinity,
        enabled: !isFuture,
      };
    }),
  });

  const joinsByDate = useMemo(() => {
    const merged: Record<string, number> = {};
    for (const q of queries) {
      if (q.data) Object.assign(merged, q.data);
    }
    return merged;
  }, [queries]);

  const loading = queries.length > 0 && queries.some((q) => q.isLoading);

  return { joinsByDate, loading };
}

// ── Sum helper (unchanged signature) ────────────────────────

/**
 * Sum Skool joins from a daily map over a date range (inclusive).
 * startDate/endDate are NZ YYYY-MM-DD strings.
 */
export function sumJoinsInRange(
  joinsByDate: Record<string, number>,
  startDate: string,
  endDate: string,
): number {
  let total = 0;
  for (const [date, count] of Object.entries(joinsByDate)) {
    if (date >= startDate && date <= endDate) total += count;
  }
  return total;
}

// ── Scorecard hook (weekly breakdown, current month) ────────

export interface SkoolJoinsData {
  weeklyJoins: (number | "—")[];
  catchUpJoins: number | "—";
  monthlyJoins: number | "—";
}

export function useSkoolJoins(): SkoolJoinsData {
  const now = new Date();
  const currentMonth = getCurrentNZMonth();
  const [y, m] = currentMonth.split("-").map(Number);
  const monthStart = `${currentMonth}-01`;
  const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  const { joinsByDate, loading } = useSkoolJoinsByRange(monthStart, monthEnd);

  const weekConfigs = useMemo(() => generateWeekConfigs(currentMonth), [currentMonth]);
  const catchUp = useMemo(() => getCatchUpRange(currentMonth), [currentMonth]);

  const weeklyJoins = useMemo<(number | "—")[]>(() => {
    if (loading) return weekConfigs.map(() => "—");
    return weekConfigs.map((wc) => {
      if (now < new Date(wc.start)) return "—";
      const startDate = toNZDate(wc.start);
      // end is exclusive in week configs, so subtract 1 day
      const endMs = new Date(wc.end).getTime() - 1;
      const endDate = toNZDate(new Date(endMs).toISOString());
      return sumJoinsInRange(joinsByDate, startDate, endDate);
    });
  }, [joinsByDate, loading, weekConfigs]);

  const catchUpJoins = useMemo<number | "—">(() => {
    if (loading || !catchUp) return "—";
    const startDate = toNZDate(catchUp.start);
    const endMs = new Date(catchUp.end).getTime() - 1;
    const endDate = toNZDate(new Date(endMs).toISOString());
    return sumJoinsInRange(joinsByDate, startDate, endDate);
  }, [joinsByDate, loading, catchUp]);

  const monthlyJoins = useMemo<number | "—">(() => {
    let sum = 0;
    let hasData = false;
    if (typeof catchUpJoins === "number") { sum += catchUpJoins; hasData = true; }
    for (const v of weeklyJoins) {
      if (typeof v === "number") { sum += v; hasData = true; }
    }
    return hasData ? sum : "—";
  }, [weeklyJoins, catchUpJoins]);

  return { weeklyJoins, catchUpJoins, monthlyJoins };
}
