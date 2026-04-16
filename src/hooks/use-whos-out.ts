import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

/** A single entry from BambooHR's /time_off/whos_out endpoint. Can be a person on
 *  time off (`timeOff`) or a company-wide holiday (`holiday`). */
export interface WhosOutEntry {
  id: number;
  type: "timeOff" | "holiday";
  employeeId?: string;
  name?: string;   // For timeOff: "First Last". For holiday: holiday name.
  start: string;   // YYYY-MM-DD
  end: string;     // YYYY-MM-DD (inclusive)
}

async function fetchWhosOut(startDate: string, endDate: string): Promise<WhosOutEntry[]> {
  if (!startDate || !endDate) return [];
  const url = `/api/bamboohr/time_off/whos_out/?start=${startDate}&end=${endDate}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Returns the lower-cased first names of teammates who are on time-off today
 *  (or in the supplied date range), plus the raw entries for callers who want more. */
export function useWhosOut(date?: Date) {
  const day = date ?? new Date();
  const dateStr = day.toISOString().slice(0, 10);

  const query = useQuery({
    queryKey: ["bamboohr-whos-out", dateStr],
    queryFn: () => fetchWhosOut(dateStr, dateStr),
    staleTime: 30 * 60 * 1000, // 30 minutes — vacation lists don't change often
  });

  const entries = query.data ?? [];

  const outFirstNames = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (e.type === "timeOff" && e.name) {
        const firstName = e.name.trim().split(/\s+/)[0];
        if (firstName) set.add(firstName.toLowerCase());
      }
    }
    return set;
  }, [entries]);

  /** Map of lowercase first name → { start, end } so callers can show "Off: Apr 15 – Apr 20". */
  const outByName = useMemo(() => {
    const map = new Map<string, { start: string; end: string }>();
    for (const e of entries) {
      if (e.type === "timeOff" && e.name) {
        const firstName = e.name.trim().split(/\s+/)[0];
        if (firstName) map.set(firstName.toLowerCase(), { start: e.start, end: e.end });
      }
    }
    return map;
  }, [entries]);

  const holidays = useMemo(
    () => entries.filter((e) => e.type === "holiday"),
    [entries]
  );

  return {
    outFirstNames,
    outByName,
    holidays,
    entries,
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
  };
}
