import { type Metric, type StatusColor } from "@/data/scorecardData";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export type StatusFilter = "ahead" | "onTrack" | "behind" | "offTrack";

interface SummaryCardsProps {
  metrics: Metric[];
  onCardClick?: (filter: StatusFilter) => void;
}

export function SummaryCards({ metrics, onCardClick }: SummaryCardsProps) {
  const statusCounts = metrics.reduce(
    (acc, m) => {
      if (m.status === "light-green") acc.ahead++;
      else if (m.status === "green") acc.onTrack++;
      else if (m.status === "yellow") acc.behind++;
      else acc.atRisk++;
      return acc;
    },
    { ahead: 0, onTrack: 0, behind: 0, atRisk: 0 }
  );

  const cards: { label: string; filter: StatusFilter; value: number; icon: typeof TrendingUp; accent: string; bg: string; border: string }[] = [
    {
      label: "Ahead",
      filter: "ahead",
      value: statusCounts.ahead,
      icon: TrendingUp,
      accent: "text-status-light-green",
      bg: "bg-status-light-green/10",
      border: "hover:border-status-light-green/40",
    },
    {
      label: "On Track",
      filter: "onTrack",
      value: statusCounts.onTrack,
      icon: CheckCircle2,
      accent: "text-status-green",
      bg: "bg-status-green/10",
      border: "hover:border-status-green/40",
    },
    {
      label: "Behind",
      filter: "behind",
      value: statusCounts.behind,
      icon: AlertTriangle,
      accent: "text-status-yellow",
      bg: "bg-status-yellow/10",
      border: "hover:border-status-yellow/40",
    },
    {
      label: "At Risk",
      filter: "offTrack",
      value: statusCounts.atRisk,
      icon: XCircle,
      accent: "text-status-red",
      bg: "bg-status-red/10",
      border: "hover:border-status-red/40",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          onClick={() => onCardClick?.(card.filter)}
          className={`rounded-xl p-5 transition-all bg-gradient-to-b from-white/[0.06] to-white/[0.02] dark:from-white/[0.05] dark:to-white/[0.01] backdrop-blur-xl ring-1 ring-black/5 dark:ring-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_2px_12px_-4px_rgba(0,0,0,0.2)] ${card.border} ${onCardClick ? "cursor-pointer" : ""}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
            <div className={`rounded-lg p-2 ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.accent}`} />
            </div>
          </div>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${card.accent}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
