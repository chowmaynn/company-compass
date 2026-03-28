import { useState, useEffect, useCallback } from "react";
import { getChannelStats, getRecentVideos, type ChannelStats, type VideoItem } from "@/lib/youtube";
import { getDailyAnalytics, bucketByWeek } from "@/lib/youtube-analytics";
import { isAuthorized } from "@/lib/youtube-auth";
import { weekConfigs } from "@/data/scorecardData";
import { LIAM_CHANNEL_ID } from "@/lib/constants";

const CHANNEL_ID = LIAM_CHANNEL_ID;

export function useYouTube() {
  const [channelStats, setChannelStats] = useState<ChannelStats | null>(null);
  const [recentVideos, setRecentVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-week video counts bucketed by weekConfigs ("—" for weeks that haven't started)
  const [weeklyVideoCounts, setWeeklyVideoCounts] = useState<(number | "—")[]>(["—", "—", "—", "—"]);
  const [weeklyViewCounts, setWeeklyViewCounts] = useState<(number | "—")[]>(["—", "—", "—", "—"]);
  const [weeklySubCounts, setWeeklySubCounts] = useState<(number | "—")[]>(["—", "—", "—", "—"]);
  const [analyticsConnected, setAnalyticsConnected] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch for the full month range (W1 start to W4 end)
      const monthStart = weekConfigs[0].start;
      const monthEnd = weekConfigs[weekConfigs.length - 1].end;

      const [stats, videos] = await Promise.all([
        getChannelStats(CHANNEL_ID),
        getRecentVideos(CHANNEL_ID, monthStart, monthEnd, 50),
      ]);

      setChannelStats(stats);
      setRecentVideos(videos);

      // Bucket videos into weeks ("—" for weeks that haven't started yet)
      const now = new Date();
      const videoCounts: (number | "—")[] = weekConfigs.map((wc) => {
        const start = new Date(wc.start);
        if (start > now) return "—";
        const end = new Date(wc.end);
        return videos.filter((v) => {
          const pub = new Date(v.publishedAt);
          return pub >= start && pub < end;
        }).length;
      });

      setWeeklyVideoCounts(videoCounts);

      // If YouTube Analytics is authorized, fetch real per-period data
      if (isAuthorized()) {
        try {
          const startDate = monthStart.slice(0, 10);
          const endDate = monthEnd.slice(0, 10);
          const rows = await getDailyAnalytics(startDate, endDate);
          const bucketed = bucketByWeek(rows, weekConfigs);
          setWeeklyViewCounts(bucketed.views);
          setWeeklySubCounts(bucketed.subscribersNet);
          setAnalyticsConnected(true);
        } catch (analyticsErr) {
          console.warn("YouTube Analytics fetch failed, falling back to Data API views:", analyticsErr);
          setAnalyticsConnected(false);
          setFallbackViewCounts(videos, now);
        }
      } else {
        setFallbackViewCounts(videos, now);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch YouTube data");
    } finally {
      setLoading(false);
    }
  }, []);

  function setFallbackViewCounts(videos: VideoItem[], now: Date) {
    const viewCounts: (number | "—")[] = weekConfigs.map((wc) => {
      const start = new Date(wc.start);
      if (start > now) return "—";
      const end = new Date(wc.end);
      return videos
        .filter((v) => {
          const pub = new Date(v.publishedAt);
          return pub >= start && pub < end;
        })
        .reduce((sum, v) => sum + v.viewCount, 0);
    });
    setWeeklyViewCounts(viewCounts);
  }

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    channelStats,
    recentVideos,
    loading,
    error,
    refetch: fetchData,
    weeklyVideoCounts,
    weeklyViewCounts,
    weeklySubCounts,
    analyticsConnected,
  };
}
