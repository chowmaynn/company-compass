import { useState } from "react";
import { Loader2, Star, MessageSquareText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompetitors, type SortBy } from "@/hooks/use-competitors";
import { YouTubeVideoCard } from "@/components/YouTubeVideoCard";
import { CompetitorInsights } from "@/components/CompetitorInsights";

export function CompetitorsDashboard() {
  const {
    channels,
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
  } = useCompetitors();

  const [showComments, setShowComments] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-sm text-muted-foreground">
        Failed to load competitor data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Insights ───────────────────────────────── */}
      <CompetitorInsights summary={summary} />

      {/* ── Filter bar ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedChannel ? String(selectedChannel) : "all"}
          onValueChange={(v) => setSelectedChannel(v === "all" ? null : Number(v))}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            {channels.map((ch) => (
              <SelectItem key={ch.id} value={String(ch.id)}>
                {ch.channel_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="most-views">Most Views</SelectItem>
            <SelectItem value="most-engagement">Most Engagement</SelectItem>
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
          {filteredVideos.length} video{filteredVideos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Video grid ─────────────────────────────── */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          No competitor videos found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <YouTubeVideoCard key={video.id} video={video} showComments={showComments} />
          ))}
        </div>
      )}
    </div>
  );
}
