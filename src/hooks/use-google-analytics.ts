import { useState, useEffect, useCallback } from "react";
import { fetchWeeklyPageViews, bucketViewsByWeek } from "@/lib/google-analytics";
import { weekConfigs } from "@/data/scorecardData";
import { isAuthorized } from "@/lib/youtube-auth";

export function useGoogleAnalytics() {
  const [weeklyViews, setWeeklyViews] = useState<(number | "—")[]>(["—", "—", "—", "—"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isAuthorized()) return;

    setLoading(true);
    setError(null);

    try {
      // Get the full date range from first week start to last week end (NZ dates)
      const firstStart = new Date(weekConfigs[0].start);
      const lastEnd = new Date(weekConfigs[weekConfigs.length - 1].end);

      // Clamp end date to today if in the future
      const now = new Date();
      const effectiveEnd = lastEnd > now ? now : lastEnd;

      const startDate = toNZDate(firstStart.toISOString());
      const endDate = toNZDate(effectiveEnd.toISOString());

      const dailyViews = await fetchWeeklyPageViews(startDate, endDate);
      const bucketed = bucketViewsByWeek(dailyViews, weekConfigs);

      setWeeklyViews(bucketed);
    } catch (err) {
      console.error("GA4 fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch GA4 data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { weeklyViews, loading, error, refetch: fetchData };
}

function toNZDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}
