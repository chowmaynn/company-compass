import { useState, useEffect, useCallback } from "react";
import { getCategorizedClicks, bucketClicksByWeek, type BitlyCategory, type DailyClickRow } from "@/lib/bitly";
import { weekConfigs } from "@/data/scorecardData";

export interface BitlyWeeklyData {
  "yt-skool": (number | "—")[];
  "yt-accelerator": (number | "—")[];
  "skool-accelerator": (number | "—")[];
  "aios-webinar": (number | "—")[];
}

export function useBitly() {
  const [weeklyClicks, setWeeklyClicks] = useState<BitlyWeeklyData>({
    "yt-skool": ["—", "—", "—", "—"],
    "yt-accelerator": ["—", "—", "—", "—"],
    "skool-accelerator": ["—", "—", "—", "—"],
    "aios-webinar": ["—", "—", "—", "—"],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const categorized = await getCategorizedClicks(31);

      const result: BitlyWeeklyData = {
        "yt-skool": ["—", "—", "—", "—"],
        "yt-accelerator": ["—", "—", "—", "—"],
        "skool-accelerator": ["—", "—", "—", "—"],
        "aios-webinar": ["—", "—", "—", "—"],
      };

      const categories: BitlyCategory[] = ["yt-skool", "yt-accelerator", "skool-accelerator", "aios-webinar"];
      for (const cat of categories) {
        const rows = categorized.get(cat) || [];
        result[cat] = bucketClicksByWeek(rows, weekConfigs);
      }

      setWeeklyClicks(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch Bitly data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    weeklyClicks,
    loading,
    error,
    refetch: fetchData,
  };
}
