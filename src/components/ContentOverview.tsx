import { useState } from "react";
import { Loader2, MessageSquareText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChannelVideos } from "@/hooks/use-channel-videos";
import { YouTubeVideoCard } from "@/components/YouTubeVideoCard";

function formatMonth(m: string): string {
  const [year, month] = m.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function ContentOverview() {
  const { videos, loading, error, month, setMonth, availableMonths } = useChannelVideos();
  const [showComments, setShowComments] = useState(false);

  return (
    <div className="space-y-6">
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
          {loading ? "…" : `${videos.length} video${videos.length !== 1 ? "s" : ""}`}
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
      ) : videos.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          No videos published in {formatMonth(month)}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <YouTubeVideoCard key={video.id} video={video} showComments={showComments} hideChannel />
          ))}
        </div>
      )}
    </div>
  );
}
