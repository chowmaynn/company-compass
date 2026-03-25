import { Eye, ThumbsUp, MessageSquare, Star, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCompactNumber, relativeTime } from "@/lib/formatNumber";

export interface VideoCardData {
  video_id: string;
  video_title: string;
  video_thumbnail: string;
  views: number;
  likes: number | null;
  comments: number | null;
  duration_minutes?: number | null;
  published_at: string;
  is_outlier?: boolean;
  channel_name?: string | null;
  comments_summary?: {
    sentiment: string;
    pain_points: string;
    what_resonated: string;
  } | null;
  // Allow joined competitor_channels
  competitor_channels?: {
    channel_name: string;
    subscribers: number;
  };
}

interface Props {
  video: VideoCardData;
  showComments?: boolean;
  hideChannel?: boolean;
}

export function YouTubeVideoCard({ video, showComments, hideChannel }: Props) {
  const channelName =
    video.channel_name || video.competitor_channels?.channel_name || "Unknown";
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.video_id}`;
  const analysis = video.comments_summary;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      {/* Thumbnail */}
      <a href={youtubeUrl} target="_blank" rel="noopener noreferrer" className="block group">
        <div className="relative aspect-video bg-muted">
          {video.video_thumbnail ? (
            <img
              src={video.video_thumbnail}
              alt={video.video_title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No thumbnail
            </div>
          )}
          {video.duration_minutes != null && (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">
              <Clock className="h-3 w-3" />
              {Math.round(video.duration_minutes)}m
            </span>
          )}
        </div>
      </a>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {!hideChannel && <span className="truncate font-medium">{channelName}</span>}
          <span className={`shrink-0 ${hideChannel ? "" : "ml-2"}`}>{relativeTime(video.published_at)}</span>
        </div>

        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <h3 className="text-sm font-medium leading-snug line-clamp-2 hover:text-primary transition-colors">
            {video.video_title}
          </h3>
        </a>

        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-0.5">
          {video.views != null && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {formatCompactNumber(video.views)}
            </span>
          )}
          {video.likes != null && (
            <span className="inline-flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" />
              {formatCompactNumber(video.likes)}
            </span>
          )}
          {video.comments != null && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {formatCompactNumber(video.comments)}
            </span>
          )}
          {video.is_outlier && (
            <Star className="h-3.5 w-3.5 ml-auto text-amber-500 fill-amber-500" />
          )}
        </div>

        {/* Comment analysis */}
        {analysis && showComments && (
          <div className="space-y-1.5 pt-2 mt-2 border-t text-xs">
            {analysis.sentiment && (
              <div>
                <span className="font-medium text-foreground">Sentiment: </span>
                <span className="text-muted-foreground">{analysis.sentiment}</span>
              </div>
            )}
            {analysis.pain_points && (
              <div>
                <span className="font-medium text-foreground">Pain points: </span>
                <span className="text-muted-foreground">{analysis.pain_points}</span>
              </div>
            )}
            {analysis.what_resonated && (
              <div>
                <span className="font-medium text-foreground">Resonated: </span>
                <span className="text-muted-foreground">{analysis.what_resonated}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
