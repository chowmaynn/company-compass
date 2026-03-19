import { type Metric, type StatusColor } from "@/data/scorecardData";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface SummaryCardsProps {
  metrics: Metric[];
}

export function SummaryCards({ metrics }: SummaryCardsProps) {
  const statusCounts = metrics.reduce(
    (acc, m) => {
      if (m.status === "green" || m.status === "light-green") acc.onTrack++;
      else if (m.status === "yellow") acc.atRisk++;
      else acc.offTrack++;
      return acc;
    },
    { onTrack: 0, atRisk: 0, offTrack: 0 }
  );

  const cards = [
    {
      label: "Total Metrics",
      value: metrics.length,
      icon: TrendingUp,
      accent: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "On Track",
      value: statusCounts.onTrack,
      icon: CheckCircle2,
      accent: "text-status-green",
      bg: "bg-status-green/10",
    },
    {
      label: "At Risk",
      value: statusCounts.atRisk,
      icon: AlertTriangle,
      accent: "text-status-yellow",
      bg: "bg-status-yellow/10",
    },
    {
      label: "Off Track",
      value: statusCounts.offTrack,
      icon: XCircle,
      accent: "text-status-red",
      bg: "bg-status-red/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:glow-primary"
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
