import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCompetitorChannels,
  fetchCompetitorVideos,
  fetchLatestSummary,
  type CompetitorChannel,
  type CompetitorVideo,
  type CompetitorSummary,
} from "@/lib/supabase-competitors";

export type SortBy = "newest" | "most-views" | "most-engagement";

async function fetchCompetitorData() {
  const [ch, vid, sum] = await Promise.all([
    fetchCompetitorChannels(),
    fetchCompetitorVideos(),
    fetchLatestSummary(),
  ]);
  return { channels: ch, videos: vid, summary: sum };
}

export function useCompetitors() {
  // Filters
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [showOutliersOnly, setShowOutliersOnly] = useState(false);

  const query = useQuery({
    queryKey: ["competitors", "all"],
    queryFn: fetchCompetitorData,
    staleTime: 5 * 60 * 1000,
  });

  const channels: CompetitorChannel[] = query.data?.channels ?? [];
  const videos: CompetitorVideo[] = query.data?.videos ?? [];
  const summary: CompetitorSummary | null = query.data?.summary ?? null;

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
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
    selectedChannel,
    setSelectedChannel,
    sortBy,
    setSortBy,
    showOutliersOnly,
    setShowOutliersOnly,
    filteredVideos,
  };
}
