import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Trophy, Phone, Target, DollarSign, ChevronDown } from "lucide-react";
import { fmtCurrency } from "@/lib/formatNumber";
import type { WeeklyRepData } from "@/hooks/use-sales-tracking";

type SortMetric = "close_rate" | "show_rate";

interface Props {
  reps: WeeklyRepData[];
  loading?: boolean;
  convert?: (nzd: number) => number;
  symbol?: string;
}

const MEDAL_COLORS = ["#F5C542", "#B0B3B8", "#C4956A"]; // gold, silver, bronze

function formatDate(date: string) {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

export function SalesLeaderboard({ reps, loading, convert = (n) => n, symbol = "$" }: Props) {
  const [sortBy, setSortBy] = useState<SortMetric>("close_rate");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const ranked = useMemo(() => {
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
          const isOpen = expanded.has(rep.rep_name);
          const rows = rep.dailyRows ?? [];

          return (
            <div key={rep.rep_name} className="rounded-lg bg-muted/20 transition-colors">
              {/* Main row */}
              <button
                onClick={() => toggle(rep.rep_name)}
                className="w-full p-3 flex items-center gap-3 hover:bg-muted/30 rounded-lg transition-colors text-left"
              >
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
                        backgroundColor: medalColor ?? "#6b7280",
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
                    {fmtCurrency(convert(rep.monthly.cc), symbol)}
                  </span>
                </div>

                {/* Chevron */}
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Expanded daily data */}
              {isOpen && rows.length > 0 && (
                <div className="px-3 pb-3">
                  <div className="rounded-md border border-border overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-muted/40 text-muted-foreground">
                          <th className="text-left px-3 py-1.5 font-medium">Date</th>
                          <th className="text-right px-3 py-1.5 font-medium">Booked</th>
                          <th className="text-right px-3 py-1.5 font-medium">Taken</th>
                          <th className="text-right px-3 py-1.5 font-medium">Show %</th>
                          <th className="text-right px-3 py-1.5 font-medium">Closes</th>
                          <th className="text-right px-3 py-1.5 font-medium">CC</th>
                          <th className="text-right px-3 py-1.5 font-medium">No Shows</th>
                          <th className="text-right px-3 py-1.5 font-medium">Cancels</th>
                          <th className="text-right px-3 py-1.5 font-medium">Reschedules</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => {
                          const showPct = r.calls_booked > 0 ? Math.round((r.calls_taken / r.calls_booked) * 100) : 0;
                          return (
                          <tr key={r.date} className="border-t border-border/50 hover:bg-muted/20">
                            <td className="px-3 py-1.5 text-foreground font-medium">{formatDate(r.date)}</td>
                            <td className="text-right px-3 py-1.5 text-muted-foreground">{r.calls_booked}</td>
                            <td className="text-right px-3 py-1.5 text-muted-foreground">{r.calls_taken}</td>
                            <td className="text-right px-3 py-1.5 text-muted-foreground">{showPct}%</td>
                            <td className="text-right px-3 py-1.5 text-foreground font-medium">{r.closes}</td>
                            <td className="text-right px-3 py-1.5 text-muted-foreground">{fmtCurrency(convert(r.cc), symbol)}</td>
                            <td className="text-right px-3 py-1.5 text-muted-foreground">{r.no_shows}</td>
                            <td className="text-right px-3 py-1.5 text-muted-foreground">{r.cancellations}</td>
                            <td className="text-right px-3 py-1.5 text-muted-foreground">{r.reschedules}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {isOpen && rows.length === 0 && (
                <p className="px-3 pb-3 text-xs text-muted-foreground">No daily data for this period.</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
