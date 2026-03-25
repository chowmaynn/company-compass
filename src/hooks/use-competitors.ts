import { useState, useEffect, useMemo, useCallback } from "react";
import {
  fetchCompetitorChannels,
  fetchCompetitorVideos,
  fetchLatestSummary,
  type CompetitorChannel,
  type CompetitorVideo,
  type CompetitorSummary,
} from "@/lib/supabase-competitors";

export type SortBy = "newest" | "most-views" | "most-engagement";

export function useCompetitors() {
  const [channels, setChannels] = useState<CompetitorChannel[]>([]);
  const [videos, setVideos] = useState<CompetitorVideo[]>([]);
  const [summary, setSummary] = useState<CompetitorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [showOutliersOnly, setShowOutliersOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ch, vid, sum] = await Promise.all([
        fetchCompetitorChannels(),
        fetchCompetitorVideos(),
        fetchLatestSummary(),
      ]);
      setChannels(ch);
      setVideos(vid);
      setSummary(sum);
    } catch (err) {
      console.error("Competitors load error:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filtered and sorted videos
  const filteredVideos = useMemo(() => {
    let result = [...videos];

    if (selectedChannel) {
      result = result.filter((v) => v.competitorchannel_id === selectedChannel);
    }

    if (showOutliersOnly) {
      result = result.filter((v) => v.is_outlier);
    }

    switch (sortBy) {
      case "most-views":
        result.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
        break;
      case "most-engagement": {
        const eng = (v: CompetitorVideo) =>
          ((v.likes ?? 0) + (v.comments ?? 0)) / Math.max(v.views ?? 1, 1);
        result.sort((a, b) => eng(b) - eng(a));
        break;
      }
      case "newest":
      default:
        result.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
        break;
    }

    return result;
  }, [videos, selectedChannel, sortBy, showOutliersOnly]);

  return {
    channels,
    videos,
    summary,
    loading,
    error,
    selectedChannel,
    setSelectedChannel,
    sortBy,
    setSortBy,
    showOutliersOnly,
    setShowOutliersOnly,
    filteredVideos,
  };
}
