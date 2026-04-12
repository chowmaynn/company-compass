import { useState, useEffect, useMemo, useRef } from "react";
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

// ── Core: daily Skool joins for a month ─────────────────────

/**
 * Fetches Skool joins per NZ day for a given month.
 * Returns a map of YYYY-MM-DD → count, with NZ-aligned boundaries and bucketing.
 * Cached across month switches so re-renders don't re-fetch.
 */
export function useSkoolJoinsByDate(year: number, month: number): {
  joinsByDate: Record<string, number>;
  loading: boolean;
} {
  const cache = useRef<Record<string, Record<string, number>>>({});
  const [joinsByDate, setJoinsByDate] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const mm = String(month + 1).padStart(2, "0");
    const cacheKey = `${year}-${mm}`;

    // Use in-memory cache if available
    if (cache.current[cacheKey] && Object.keys(cache.current[cacheKey]).length > 0) {
      setJoinsByDate(cache.current[cacheKey]);
      setLoading(false);
      // Past months: don't refetch
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      if (cacheKey !== currentMonth) return;
    } else {
      setJoinsByDate({});
      setLoading(true);
    }

    const nzOffsetMs = getNZOffsetMs(year, month);

    async function fetchMonth() {
      const result: Record<string, number> = {};
      const daysInMo = new Date(year, month + 1, 0).getDate();
      const isCurrentMo = year === now.getFullYear() && month === now.getMonth();
      const maxDay = isCurrentMo ? now.getDate() : daysInMo;

      // Fetch in 2-day chunks with NZ-aligned UTC boundaries
      const CHUNK_DAYS = 2;
      for (let startDay = 1; startDay <= maxDay; startDay += CHUNK_DAYS) {
        if (cancelled) break;
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
              // Bucket by NZ date
              const date = toNZDate(row["Created At"] ?? "");
              if (date && date.startsWith(`${year}-${mm}`)) {
                result[date] = (result[date] || 0) + 1;
              }
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 200));
      }

      if (!cancelled) {
        if (Object.keys(result).length > 0) {
          cache.current[cacheKey] = result;
          setJoinsByDate(result);
        }
        setLoading(false);
      }
    }

    fetchMonth();
    return () => { cancelled = true; };
  }, [year, month]);

  return { joinsByDate, loading };
}

// ── Derived: sum joins over a NZ date range ─────────────────

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

// ── Scorecard hook (weekly breakdown) ───────────────────────

export interface SkoolJoinsData {
  weeklyJoins: (number | "—")[];
  catchUpJoins: number | "—";
  monthlyJoins: number | "—";
}

export function useSkoolJoins(): SkoolJoinsData {
  const now = new Date();
  const currentMonth = getCurrentNZMonth();
  const [y, m] = currentMonth.split("-").map(Number);
  const { joinsByDate, loading } = useSkoolJoinsByDate(y, m - 1); // month is 0-indexed

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
