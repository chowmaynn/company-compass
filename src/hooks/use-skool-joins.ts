import { useState, useEffect, useMemo } from "react";
import { generateWeekConfigs, getCurrentNZMonth, getCatchUpRange } from "@/data/scorecardData";

const SKOOL_BASE = "/api/skool-supabase";
const TABLE = "Skool%20Lead%20Logs";
const COL = "%22Date%20Added%22";

const ONE_DAY_MS = 86400000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

/** Fetch join count for a single chunk. Use higher limit for wider ranges. */
async function fetchChunk(start: string, end: string, limit = 2000): Promise<number> {
  const url = `${SKOOL_BASE}/rest/v1/${TABLE}?select=${COL}&${COL}=gte.${start}&${COL}=lt.${end}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("Skool joins fetch error:", res.status, { start, end });
    return 0;
  }
  const rows: unknown[] = await res.json();
  if (rows.length === limit) {
    console.warn(`Skool joins hit ${limit} limit — count may be truncated`, { start, end });
  }
  return rows.length;
}

/** Fetch join count for an arbitrary range, chunking to avoid DB timeout. */
async function fetchJoinCount(start: string, end: string): Promise<number> {
  let startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();

  // If start >= end (same timestamp, e.g. "today"), expand to a full day
  if (startMs >= endMs) {
    return fetchChunk(start, new Date(startMs + ONE_DAY_MS).toISOString());
  }

  const spanMs = endMs - startMs;

  // Short range (≤ 1 day): single fetch
  if (spanMs <= ONE_DAY_MS) {
    return fetchChunk(start, end);
  }

  // Medium range (≤ 1 week): daily chunks, sequential
  if (spanMs <= ONE_WEEK_MS) {
    let total = 0;
    let cursor = startMs;
    while (cursor < endMs) {
      const chunkEnd = Math.min(cursor + ONE_DAY_MS, endMs);
      total += await fetchChunk(new Date(cursor).toISOString(), new Date(chunkEnd).toISOString());
      cursor = chunkEnd;
    }
    return total;
  }

  // Long range (> 1 week): weekly chunks with higher limit, sequential
  let total = 0;
  let cursor = startMs;
  while (cursor < endMs) {
    const chunkEnd = Math.min(cursor + ONE_WEEK_MS, endMs);
    total += await fetchChunk(new Date(cursor).toISOString(), new Date(chunkEnd).toISOString(), 5000);
    cursor = chunkEnd;
  }
  return total;
}

export interface SkoolJoinsData {
  weeklyJoins: (number | "—")[];
  catchUpJoins: number | "—";
  monthlyJoins: number | "—";
}

export function useSkoolJoins(): SkoolJoinsData {
  const [weeklyJoins, setWeeklyJoins] = useState<(number | "—")[]>(["—", "—", "—", "—"]);
  const [catchUpJoins, setCatchUpJoins] = useState<number | "—">("—");

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const currentMonth = getCurrentNZMonth();
    const weekConfigs = generateWeekConfigs(currentMonth);
    const catchUp = getCatchUpRange(currentMonth);

    // Build date ranges: catch-up + each week
    const ranges: { key: string; start: string; end: string }[] = [];
    if (catchUp) {
      ranges.push({ key: "catchup", start: catchUp.start, end: catchUp.end });
    }
    for (let i = 0; i < weekConfigs.length; i++) {
      const wc = weekConfigs[i];
      if (now < new Date(wc.start)) break;
      ranges.push({ key: `w${i}`, start: wc.start, end: wc.end });
    }

    Promise.all(ranges.map((r) => fetchJoinCount(r.start, r.end))).then(
      (counts) => {
        if (cancelled) return;
        const weekly: (number | "—")[] = weekConfigs.map(() => "—");
        let catchUp: number | "—" = "—";

        for (let i = 0; i < ranges.length; i++) {
          const { key } = ranges[i];
          if (key === "catchup") {
            catchUp = counts[i];
          } else {
            const weekIdx = parseInt(key.replace("w", ""));
            weekly[weekIdx] = counts[i];
          }
        }

        setWeeklyJoins(weekly);
        setCatchUpJoins(catchUp);
      }
    );

    return () => { cancelled = true; };
  }, []);

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

/**
 * Convert a NZ date string (YYYY-MM-DD) to UTC ISO for the start of that NZ day.
 * NZ is UTC+12 (NZST) or UTC+13 (NZDT). We approximate using a fixed offset;
 * for exact accuracy we'd need a timezone library, but ±1h is acceptable here.
 */
function nzDayToUtc(nzDate: string, endOfDay = false): string {
  // Current NZ offset: April = NZST (UTC+12), Oct-Mar = NZDT (UTC+13)
  const month = parseInt(nzDate.split("-")[1]);
  const offsetHours = (month >= 4 && month <= 9) ? 12 : 13;
  const d = new Date(`${nzDate}T${endOfDay ? "23:59:59" : "00:00:00"}Z`);
  d.setHours(d.getHours() - offsetHours);
  return d.toISOString();
}

/**
 * Fetch total Skool joins for a date range.
 * Accepts NZ date strings (YYYY-MM-DD) for startDate/endDate to ensure correct timezone handling.
 */
export function useSkoolJoinsRange(startDate: string, endDate: string): { joins: number | null; loading: boolean } {
  const [joins, setJoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!startDate || !endDate) { setJoins(null); return; }
    let cancelled = false;
    setLoading(true);
    // Convert NZ dates to UTC boundaries
    const utcStart = nzDayToUtc(startDate);
    // End is inclusive (end of day), so add 1 second to cover the full day
    const utcEnd = nzDayToUtc(endDate, true);
    fetchJoinCount(utcStart, utcEnd).then((count) => {
      if (!cancelled) { setJoins(count); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  return { joins, loading };
}
