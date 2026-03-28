import { useQuery } from "@tanstack/react-query";
import { fetchPageSessions } from "@/lib/google-analytics";
import { weekConfigs } from "@/data/scorecardData";
import { toNZDate } from "@/lib/dates";

async function fetchGA4Data(): Promise<{ weekly: (number | "—")[]; monthly: number | "—" }> {
  const today = toNZDate(new Date().toISOString());
  const monthStart = today.slice(0, 7) + "-01";

  const [w1, w2, w3, w4, month] = await Promise.all([
    ...weekConfigs.map(async (wc) => {
      try { return await fetchPageSessions(toNZDate(wc.start), toNZDate(wc.end)); }
      catch { return "—" as const; }
    }),
    fetchPageSessions(monthStart, today).catch(() => "—" as const),
  ]);

  return { weekly: [w1, w2, w3, w4], monthly: month };
}

export function useGoogleAnalytics() {
  const query = useQuery({
    queryKey: ["google-analytics", "weekly-views"],
    queryFn: fetchGA4Data,
    staleTime: 5 * 60 * 1000,
  });

  return {
    weeklyViews: query.data?.weekly ?? ["—", "—", "—", "—"] as (number | "—")[],
    monthlyViews: query.data?.monthly ?? ("—" as number | "—"),
    loading: query.isLoading,
    error: query.error ? (query.error instanceof Error ? query.error.message : "Failed to fetch GA4 data") : null,
    refetch: query.refetch,
  };
}
