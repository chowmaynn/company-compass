import { useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchSalesTracking,
  fetchSalesMonths,
  updateSalesTrackingCell,
  upsertSalesTrackingCell,
  type SalesTrackingRow,
  type SalesMetricField,
} from "@/lib/supabase-sales";
import { generateWeekConfigs } from "@/data/scorecardData";

export interface WeekMetrics {
  calls_booked: number;
  calls_taken: number;
  closes: number;
  cc: number;
  no_shows: number;
  cancellations: number;
  reschedules: number;
  show_rate: number | null;
  close_rate: number | null;
}

export interface WeeklyRepData {
  rep_name: string;
  weeks: WeekMetrics[];
  monthly: WeekMetrics;
  catchUp: WeekMetrics;
  dailyRows: SalesTrackingRow[]; // raw daily data for expandable view
}

function emptyMetrics(): WeekMetrics {
  return {
    calls_booked: 0,
    calls_taken: 0,
    closes: 0,
    cc: 0,
    no_shows: 0,
    cancellations: 0,
    reschedules: 0,
    show_rate: null,
    close_rate: null,
  };
}

function sumMetrics(rows: SalesTrackingRow[]): WeekMetrics {
  const m = emptyMetrics();
  for (const r of rows) {
    m.calls_booked += r.calls_booked;
    m.calls_taken += r.calls_taken;
    m.closes += r.closes;
    m.cc += r.cc;
    m.no_shows += r.no_shows;
    m.cancellations += r.cancellations;
    m.reschedules += r.reschedules;
  }
  m.show_rate = m.calls_booked > 0 ? Math.round((m.calls_taken / m.calls_booked) * 100) : null;
  m.close_rate = m.calls_taken > 0 ? Math.round((m.closes / m.calls_taken) * 100) : null;
  return m;
}

/**
 * Returns the week index (0-3) for a date, or -1 for catch-up days.
 * Uses Monday-aligned week boundaries from generateWeekConfigs.
 */
function getWeekIndex(date: string, month: string): number {
  const configs = generateWeekConfigs(month);
  // Convert date to a comparable NZ date string (YYYY-MM-DD)
  for (let i = 0; i < configs.length; i++) {
    const startNZ = new Date(configs[i].start).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
    const endNZ = new Date(configs[i].end).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
    if (date >= startNZ && date < endNZ) return i;
  }
  // Before W1 = catch-up
  const w1StartNZ = new Date(configs[0].start).toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
  if (date < w1StartNZ) return -1;
  return 3; // After W4 end — shouldn't happen but fallback to W4
}

function aggregateByRep(rows: SalesTrackingRow[], month: string): WeeklyRepData[] {
  // Group by rep
  const byRep = new Map<string, SalesTrackingRow[]>();
  for (const row of rows) {
    const arr = byRep.get(row.rep_name) || [];
    arr.push(row);
    byRep.set(row.rep_name, arr);
  }

  const result: WeeklyRepData[] = [];
  for (const [repName, repRows] of byRep) {
    // Bucket into catch-up (-1) + weeks (0-3)
    const catchUpRows: SalesTrackingRow[] = [];
    const weekBuckets: SalesTrackingRow[][] = [[], [], [], []];
    for (const row of repRows) {
      const wi = getWeekIndex(row.date, month);
      if (wi === -1) {
        catchUpRows.push(row);
      } else {
        weekBuckets[wi].push(row);
      }
    }

    const weeks = weekBuckets.map(sumMetrics);
    const monthly = sumMetrics(repRows);
    const catchUp = sumMetrics(catchUpRows);

    result.push({ rep_name: repName, weeks, monthly, dailyRows: repRows, catchUp });
  }

  // Sort reps alphabetically
  result.sort((a, b) => a.rep_name.localeCompare(b.rep_name));
  return result;
}

function computeTeamTotals(reps: WeeklyRepData[]): WeeklyRepData {
  const weekCount = 4;
  const weeks: WeekMetrics[] = [];

  for (let w = 0; w < weekCount; w++) {
    const m = emptyMetrics();
    for (const rep of reps) {
      if (rep.weeks[w]) {
        m.calls_booked += rep.weeks[w].calls_booked;
        m.calls_taken += rep.weeks[w].calls_taken;
        m.closes += rep.weeks[w].closes;
        m.cc += rep.weeks[w].cc;
        m.no_shows += rep.weeks[w].no_shows;
        m.cancellations += rep.weeks[w].cancellations;
        m.reschedules += rep.weeks[w].reschedules;
      }
    }
    m.show_rate = m.calls_booked > 0 ? Math.round((m.calls_taken / m.calls_booked) * 100) : null;
    m.close_rate = m.calls_taken > 0 ? Math.round((m.closes / m.calls_taken) * 100) : null;
    weeks.push(m);
  }

  const catchUp = emptyMetrics();
  for (const rep of reps) {
    catchUp.calls_booked += rep.catchUp.calls_booked;
    catchUp.calls_taken += rep.catchUp.calls_taken;
    catchUp.closes += rep.catchUp.closes;
    catchUp.cc += rep.catchUp.cc;
    catchUp.no_shows += rep.catchUp.no_shows;
    catchUp.cancellations += rep.catchUp.cancellations;
    catchUp.reschedules += rep.catchUp.reschedules;
  }
  catchUp.show_rate = catchUp.calls_booked > 0 ? Math.round((catchUp.calls_taken / catchUp.calls_booked) * 100) : null;
  catchUp.close_rate = catchUp.calls_taken > 0 ? Math.round((catchUp.closes / catchUp.calls_taken) * 100) : null;

  const monthly = emptyMetrics();
  for (const rep of reps) {
    monthly.calls_booked += rep.monthly.calls_booked;
    monthly.calls_taken += rep.monthly.calls_taken;
    monthly.closes += rep.monthly.closes;
    monthly.cc += rep.monthly.cc;
    monthly.no_shows += rep.monthly.no_shows;
    monthly.cancellations += rep.monthly.cancellations;
    monthly.reschedules += rep.monthly.reschedules;
  }
  monthly.show_rate = monthly.calls_booked > 0 ? Math.round((monthly.calls_taken / monthly.calls_booked) * 100) : null;
  monthly.close_rate = monthly.calls_taken > 0 ? Math.round((monthly.closes / monthly.calls_taken) * 100) : null;

  return { rep_name: "TEAM", weeks, monthly, catchUp, dailyRows: [] };
}

export function useSalesTracking(month: string) {
  const queryClient = useQueryClient();

  const dataQuery = useQuery({
    queryKey: ["sales-tracking", month],
    queryFn: () => fetchSalesTracking(month),
    staleTime: 5 * 60 * 1000,
    enabled: !!month,
  });

  const monthsQuery = useQuery({
    queryKey: ["sales-tracking", "months"],
    queryFn: fetchSalesMonths,
    staleTime: 30 * 60 * 1000,
  });

  // Today's date in NZT (YYYY-MM-DD)
  const todayDate = useMemo(() => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
  }, []);

  // Check if today is in the selected month
  const isTodayInMonth = todayDate.startsWith(month);

  const reps = useMemo(
    () => aggregateByRep(dataQuery.data ?? [], month),
    [dataQuery.data, month]
  );

  const teamTotals = useMemo(() => computeTeamTotals(reps), [reps]);

  // Get today's row for a rep (or null if doesn't exist yet)
  const getTodayRow = useCallback(
    (repName: string): SalesTrackingRow | null => {
      return (dataQuery.data ?? []).find((r) => r.rep_name === repName && r.date === todayDate) ?? null;
    },
    [dataQuery.data, todayDate]
  );

  const updateCell = useCallback(
    async (repName: string, date: string, field: SalesMetricField, value: number) => {
      // Optimistic update
      queryClient.setQueryData<SalesTrackingRow[]>(["sales-tracking", month], (old) => {
        if (!old) return old;
        return old.map((r) =>
          r.rep_name === repName && r.date === date ? { ...r, [field]: value } : r
        );
      });

      // Persist
      const ok = await updateSalesTrackingCell(repName, date, field, value);
      if (!ok) {
        queryClient.invalidateQueries({ queryKey: ["sales-tracking", month] });
      }
    },
    [queryClient, month]
  );

  // Upsert today's cell — creates row if missing, updates if exists
  const upsertTodayCell = useCallback(
    async (repName: string, field: SalesMetricField, value: number) => {
      // Optimistic update — add or update the row in cache
      queryClient.setQueryData<SalesTrackingRow[]>(["sales-tracking", month], (old) => {
        if (!old) return old;
        const existing = old.find((r) => r.rep_name === repName && r.date === todayDate);
        if (existing) {
          return old.map((r) =>
            r.rep_name === repName && r.date === todayDate ? { ...r, [field]: value } : r
          );
        }
        // Create new row in cache
        return [...old, {
          id: 0,
          rep_name: repName,
          date: todayDate,
          calls_booked: 0,
          calls_taken: 0,
          closes: 0,
          cc: 0,
          no_shows: 0,
          cancellations: 0,
          reschedules: 0,
          [field]: value,
        }];
      });

      // Persist via upsert
      const ok = await upsertSalesTrackingCell(repName, todayDate, field, value);
      if (!ok) {
        queryClient.invalidateQueries({ queryKey: ["sales-tracking", month] });
      }
    },
    [queryClient, month, todayDate]
  );

  return {
    reps,
    teamTotals,
    todayDate,
    isTodayInMonth,
    getTodayRow,
    isLoading: dataQuery.isLoading,
    isError: dataQuery.isError,
    availableMonths: monthsQuery.data ?? [],
    updateCell,
    upsertTodayCell,
  };
}
