import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Trophy, Phone, Target, DollarSign } from "lucide-react";
import { fmtCurrency } from "@/lib/formatNumber";
import type { WeeklyRepData } from "@/hooks/use-sales-tracking";

type SortMetric = "close_rate" | "show_rate";

interface Props {
  reps: WeeklyRepData[];
  loading?: boolean;
}

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"]; // gold, silver, bronze

export function SalesLeaderboard({ reps, loading }: Props) {
  const [sortBy, setSortBy] = useState<SortMetric>("close_rate");

  const ranked = useMemo(() => {
    // Filter out reps with 0 calls taken (can't compute rates)
    const eligible = reps.filter((r) => r.monthly.calls_taken > 0);

    return [...eligible].sort((a, b) => {
      const aVal = sortBy === "close_rate" ? (a.monthly.close_rate ?? 0) : (a.monthly.show_rate ?? 0);
      const bVal = sortBy === "close_rate" ? (b.monthly.close_rate ?? 0) : (b.monthly.show_rate ?? 0);
      return bVal - aVal;
    });
  }, [reps, sortBy]);

  const maxRate = ranked.length > 0
    ? (sortBy === "close_rate" ? (ranked[0].monthly.close_rate ?? 0) : (ranked[0].monthly.show_rate ?? 0))
    : 0;

  if (loading) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Leaderboard</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (ranked.length === 0) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Leaderboard</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-3">No rep data available for this month.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Leaderboard</h3>
        </div>

        {/* Sort toggle */}
        <div className="flex items-center gap-1 bg-black/5 dark:bg-black/40 backdrop-blur-sm rounded-full px-1 py-0.5 ring-1 ring-black/10 dark:ring-white/10">
          <button
            onClick={() => setSortBy("close_rate")}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
              sortBy === "close_rate"
                ? "bg-black/10 dark:bg-white/20 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Close Rate
          </button>
          <button
            onClick={() => setSortBy("show_rate")}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
              sortBy === "show_rate"
                ? "bg-black/10 dark:bg-white/20 text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Show Rate
          </button>
        </div>
      </div>

      {/* Rankings */}
      <div className="space-y-2">
        {ranked.map((rep, i) => {
          const rate = sortBy === "close_rate" ? (rep.monthly.close_rate ?? 0) : (rep.monthly.show_rate ?? 0);
          const barWidth = maxRate > 0 ? (rate / maxRate) * 100 : 0;
          const medalColor = i < 3 ? MEDAL_COLORS[i] : undefined;

          return (
            <div
              key={rep.rep_name}
              className="rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors p-3"
            >
              <div className="flex items-center gap-3">
                {/* Rank badge */}
                <div
                  className="flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0"
                  style={{
                    backgroundColor: medalColor ? `${medalColor}20` : "hsl(var(--muted))",
                    color: medalColor ?? "hsl(var(--muted-foreground))",
                    border: medalColor ? `1.5px solid ${medalColor}` : "1px solid hsl(var(--border))",
                  }}
                >
                  {i + 1}
                </div>

                {/* Name + primary metric */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">{rep.rep_name}</span>
                    <span className="text-sm font-bold text-foreground ml-2 shrink-0">
                      {rate.toFixed(0)}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-muted/50 mt-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: medalColor ?? "hsl(var(--primary))",
                      }}
                    />
                  </div>
                </div>

                {/* Secondary stats */}
                <div className="flex items-center gap-4 text-[11px] text-muted-foreground shrink-0 ml-2">
                  <span className="inline-flex items-center gap-1" title="Calls Taken">
                    <Phone className="h-3 w-3" />
                    {rep.monthly.calls_taken}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Closes">
                    <Target className="h-3 w-3" />
                    {rep.monthly.closes}
                  </span>
                  <span className="inline-flex items-center gap-1" title="Contract Value">
                    <DollarSign className="h-3 w-3" />
                    {fmtCurrency(rep.monthly.cc)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
