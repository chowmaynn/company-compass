import { Eye, ThumbsUp, MessageSquare, Clock, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCompactNumber, relativeTime } from "@/lib/formatNumber";
import type { Idea } from "@/lib/supabase-competitors";

interface Props {
  idea: Idea;
}

function parseCommentsSummary(raw: Idea["comments_summary"]): {
  sentiment: string;
  pain_points: string;
  what_resonated: string;
} | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as { sentiment: string; pain_points: string; what_resonated: string };
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function IdeaCard({ idea }: Props) {
  const analysis = parseCommentsSummary(idea.comments_summary);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Thumbnail */}
        <a
          href={idea.reference_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 sm:w-56 aspect-video sm:aspect-auto bg-muted relative group"
        >
          {idea.reference_image ? (
            <img
              src={idea.reference_image}
              alt={idea.reference_title}
              className="w-full h-full object-cover sm:h-full"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full min-h-[120px] flex items-center justify-center text-muted-foreground text-xs">
              No thumbnail
            </div>
          )}
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-amber-500/90 px-2 py-0.5 text-[11px] font-semibold text-white">
            <TrendingUp className="h-3 w-3" />
            Outlier
          </span>
        </a>

        {/* Content */}
        <div className="flex-1 p-4 space-y-3 min-w-0">
          {/* Title + meta */}
          <div>
            <a
              href={idea.reference_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium leading-snug hover:text-primary transition-colors line-clamp-2"
            >
              {idea.reference_title}
            </a>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="font-medium">{idea.channel_name}</span>
              {idea.reference_publishdate && (
                <span>{relativeTime(idea.reference_publishdate)}</span>
              )}
              {idea.reference_videoDuration != null && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.round(idea.reference_videoDuration)}m
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {idea.views != null && (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {formatCompactNumber(idea.views)}
              </span>
            )}
            {idea.likes != null && (
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5" />
                {formatCompactNumber(idea.likes)}
              </span>
            )}
            {idea.comments != null && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {formatCompactNumber(idea.comments)}
              </span>
            )}
          </div>

          {/* Comment analysis */}
          {analysis && (
            <div className="space-y-2 pt-1 border-t text-xs">
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
                  <span className="font-medium text-foreground">What resonated: </span>
                  <span className="text-muted-foreground">{analysis.what_resonated}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
