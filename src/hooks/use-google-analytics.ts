import { useQuery } from "@tanstack/react-query";
import { fetchPageSessions } from "@/lib/google-analytics";
import { getCurrentWeekIndex, generateWeekConfigs, getCurrentNZMonth } from "@/data/scorecardData";
import { toNZDate } from "@/lib/dates";

async function fetchGA4Data(): Promise<{ weekly: (number | "—")[]; monthly: number | "—" }> {
  const today = toNZDate(new Date().toISOString());
  const monthStart = today.slice(0, 7) + "-01";
  const weekConfigs = generateWeekConfigs(getCurrentNZMonth());
  const cwi = getCurrentWeekIndex(weekConfigs);

  // Only fetch current week + monthly (historical weeks are in Supabase scorecard table)
  const weekly: (number | "—")[] = ["—", "—", "—", "—"];
  const calls: Promise<void>[] = [];

  // Current week
  if (cwi >= 0 && cwi < 4) {
    calls.push(
      fetchPageSessions(toNZDate(weekConfigs[cwi].start), toNZDate(weekConfigs[cwi].end))
        .then((v) => { weekly[cwi] = v; })
        .catch(() => {})
    );
  }

  // Monthly (single deduplicated query)
  let monthly: number | "—" = "—";
  calls.push(
    fetchPageSessions(monthStart, today)
      .then((v) => { monthly = v; })
      .catch(() => {})
  );

  await Promise.all(calls);
  return { weekly, monthly };
}

export function useGoogleAnalytics() {
  const query = useQuery({
    queryKey: ["google-analytics", "weekly-views"],
    queryFn: fetchGA4Data,
  });

  return {
    weeklyViews: query.data?.weekly ?? ["—", "—", "—", "—"] as (number | "—")[],
    monthlyViews: query.data?.monthly ?? ("—" as number | "—"),
    loading: query.isLoading,
    error: query.error ? (query.error instanceof Error ? query.error.message : "Failed to fetch GA4 data") : null,
    refetch: query.refetch,
  };
}
