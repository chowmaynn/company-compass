import { useState, useMemo } from "react";
import { Loader2, MessageSquareText, Star } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChannelVideos } from "@/hooks/use-channel-videos";
import { YouTubeVideoCard } from "@/components/YouTubeVideoCard";
import { ChannelInsights } from "@/components/ChannelInsights";

type SortBy = "newest" | "most-views";

function formatMonth(m: string): string {
  const [year, month] = m.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function ContentOverview() {
  const { videos, summary, loading, error, month, setMonth, availableMonths } = useChannelVideos();
  const [showComments, setShowComments] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [showOutliersOnly, setShowOutliersOnly] = useState(false);

  // Calculate outliers: views > 1.5× month average
  const { sortedVideos, outlierIds, avgViews } = useMemo(() => {
    if (videos.length === 0) return { sortedVideos: [], outlierIds: new Set<number>(), avgViews: 0 };

    const avg = videos.reduce((sum, v) => sum + (v.views ?? 0), 0) / videos.length;
    const threshold = avg * 1.5;
    const ids = new Set<number>(
      videos.filter((v) => (v.views ?? 0) > threshold).map((v) => v.id)
    );

    let sorted = [...videos];
    if (sortBy === "most-views") {
      sorted.sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    } else {
      sorted.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
    }

    if (showOutliersOnly) {
      sorted = sorted.filter((v) => ids.has(v.id));
    }

    return { sortedVideos: sorted, outlierIds: ids, avgViews: avg };
  }, [videos, sortBy, showOutliersOnly]);

  return (
    <div className="space-y-6">
      {/* Channel insights */}
      <ChannelInsights summary={summary} />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableMonths.map((m) => (
              <SelectItem key={m} value={m}>
                {formatMonth(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="most-views">Most Views</SelectItem>
          </SelectContent>
        </Select>

        <button
          onClick={() => setShowOutliersOnly(!showOutliersOnly)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
            showOutliersOnly
              ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
              : "border-input text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          <Star className="h-3.5 w-3.5" />
          Outliers Only
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
            showComments
              ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400"
              : "border-input text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          <MessageSquareText className="h-3.5 w-3.5" />
          Comments
        </button>

        <span className="text-xs text-muted-foreground ml-auto">
          {loading ? "…" : `${sortedVideos.length} video${sortedVideos.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-20 text-sm text-muted-foreground">
          Failed to load videos.
        </div>
      ) : sortedVideos.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          {showOutliersOnly
            ? `No outliers in ${formatMonth(month)}.`
            : `No videos published in ${formatMonth(month)}.`}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedVideos.map((video) => (
            <YouTubeVideoCard
              key={video.id}
              video={{ ...video, is_outlier: outlierIds.has(video.id) }}
              showComments={showComments}
              hideChannel
            />
          ))}
        </div>
      )}
    </div>
  );
}
