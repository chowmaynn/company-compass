import { useState } from "react";
import { Lightbulb, TrendingUp, AlertCircle, Heart, Users, Type, Rocket, Video, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ChannelSummary } from "@/hooks/use-channel-videos";

interface Props {
  summary: ChannelSummary | null;
}

function Badge({ children, variant }: { children: React.ReactNode; variant: "blue" | "red" | "green" | "amber" | "purple" }) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    green: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

export function ChannelInsights({ summary }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (!summary) return null;

  const { performance_insights, audience_wants, pain_points, what_worked, title_analysis, recommendations } = summary.summary;

  return (
    <Card className="overflow-hidden border-l-4 border-l-blue-500/50">
      <div className="p-5 space-y-4">
        {/* Header — clickable toggle */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-foreground">Channel Insights</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Video className="h-3 w-3" />
              {summary.total_videos} videos
            </span>
            <span className="inline-flex items-center gap-1">
              avg {summary.avg_views?.toLocaleString()} views
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </button>

        {/* Collapsible content */}
        {isOpen && (
          <div className="space-y-4">
            {/* Performance insights */}
            {performance_insights?.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Performance Insights
                </div>
                <ul className="space-y-1 ml-5 text-xs text-muted-foreground list-disc">
                  {performance_insights.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Chips grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Audience wants */}
              {audience_wants?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Users className="h-3.5 w-3.5 text-blue-500" />
                    Audience Wants
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {audience_wants.map((t, i) => (
                      <Badge key={i} variant="blue">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Pain points */}
              {pain_points?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                    Pain Points
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {pain_points.map((p, i) => (
                      <Badge key={i} variant="red">{p}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* What worked */}
              {what_worked?.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Heart className="h-3.5 w-3.5 text-green-500" />
                    What Worked
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {what_worked.map((w, i) => (
                      <Badge key={i} variant="green">{w}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Title analysis */}
            {title_analysis?.length > 0 && (
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

            {/* Recommendations */}
            {recommendations?.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Rocket className="h-3.5 w-3.5 text-amber-500" />
                  Recommendations
                </div>
                <ul className="space-y-1 ml-5 text-xs text-muted-foreground list-disc">
                  {recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
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
