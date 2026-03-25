import { useState } from "react";
import { Lightbulb, TrendingUp, AlertCircle, Heart, Video, Star, Clock, Type, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/lib/formatNumber";
import type { CompetitorSummary } from "@/lib/supabase-competitors";

interface Props {
  summary: CompetitorSummary | null;
}

function Badge({ children, variant }: { children: React.ReactNode; variant: "blue" | "red" | "green" | "amber" }) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    green: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

export function CompetitorInsights({ summary }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (!summary) return null;

  const { takeaways, trending_topics, top_pain_points, what_resonated, title_analysis } = summary.summary;

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary/50">
      <div className="p-5 space-y-4">
        {/* Header — clickable toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Competitor Insights</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Video className="h-3 w-3" />
              {summary.total_videos} videos
            </span>
            {summary.outlier_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 text-amber-500" />
                {summary.outlier_count} outliers
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {relativeTime(summary.created_at)}
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </button>

        {/* Collapsible content */}
        {isOpen && (
          <div className="space-y-4">

        {/* Takeaways */}
        {takeaways?.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Key Takeaways
            </div>
            <ul className="space-y-1 ml-5 text-xs text-muted-foreground list-disc">
              {takeaways.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Chips row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Trending */}
          {trending_topics?.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                Trending
              </div>
              <div className="flex flex-wrap gap-1.5">
                {trending_topics.map((t, i) => (
                  <Badge key={i} variant="blue">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Pain points */}
          {top_pain_points?.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                Pain Points
              </div>
              <div className="flex flex-wrap gap-1.5">
                {top_pain_points.map((p, i) => (
                  <Badge key={i} variant="red">{p}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Resonated */}
          {what_resonated?.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Heart className="h-3.5 w-3.5 text-green-500" />
                What Resonated
              </div>
              <div className="flex flex-wrap gap-1.5">
                {what_resonated.map((w, i) => (
                  <Badge key={i} variant="green">{w}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Title analysis */}
        {title_analysis && title_analysis.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Type className="h-3.5 w-3.5 text-purple-500" />
              Title Analysis
            </div>
            <ul className="space-y-1 ml-5 text-xs text-muted-foreground list-disc">
              {title_analysis.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}

          </div>
        )}
      </div>
    </Card>
  );
}
