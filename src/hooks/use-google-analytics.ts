import { useQuery } from "@tanstack/react-query";
import { fetchWeeklyPageViews, bucketViewsByWeek } from "@/lib/google-analytics";
import { weekConfigs } from "@/data/scorecardData";
import { isAuthorized } from "@/lib/youtube-auth";

function toNZDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}

async function fetchGA4Data(): Promise<(number | "—")[]> {
  const firstStart = new Date(weekConfigs[0].start);
  const lastEnd = new Date(weekConfigs[weekConfigs.length - 1].end);

  const now = new Date();
  const effectiveEnd = lastEnd > now ? now : lastEnd;

  const startDate = toNZDate(firstStart.toISOString());
  const endDate = toNZDate(effectiveEnd.toISOString());

  const dailyViews = await fetchWeeklyPageViews(startDate, endDate);
  return bucketViewsByWeek(dailyViews, weekConfigs);
}

export function useGoogleAnalytics() {
  const query = useQuery({
    queryKey: ["google-analytics", "weekly-views"],
    queryFn: fetchGA4Data,
    staleTime: 5 * 60 * 1000,
    enabled: isAuthorized(),
  });

  return {
    weeklyViews: query.data ?? ["—", "—", "—", "—"] as (number | "—")[],
    loading: query.isLoading,
    error: query.error ? (query.error instanceof Error ? query.error.message : "Failed to fetch GA4 data") : null,
    refetch: query.refetch,
  };
}
