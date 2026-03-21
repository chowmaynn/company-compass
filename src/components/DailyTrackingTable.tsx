import React from "react";
import {
  dailyDateLabels,
  dailyMarketingMetrics,
  type DailyMetric,
} from "@/data/dailyMarketingData";
import { parseNumeric } from "@/lib/calculateStatus";

/**
 * Determine cell background color by comparing actual value to the daily target.
 * Daily target = monthlyTarget / 31 (days in March).
 * Green if actual >= daily target, red if below.
 * Percentage metrics compare directly to the monthly target percentage.
 */
function getCellColor(
  value: number | string,
  metric: DailyMetric
): string {
  if (value === "—" || value === "") return "";

  const actual = parseNumeric(value);
  if (actual === null) return "";

  const target = parseNumeric(metric.monthlyTarget);
  if (target === null || target === 0) return "";

  // For percentage metrics, compare directly to target percentage
  const dailyTarget = metric.isPercentage ? target : target / 31;

  if (actual >= dailyTarget) {
    return "bg-status-green/25";
  }
  return "bg-status-red/25";
}

export function DailyTrackingTable() {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Daily Tracking</p>
      <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/90 backdrop-blur-sm px-4 py-2 text-left font-semibold text-foreground min-w-[220px] border-r border-border/50">
                  Metric
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[70px]">
                  Target
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap min-w-[70px] border-r border-border/30">
                  Proj
                </th>
                {dailyDateLabels.map((label) => (
                  <th
                    key={label}
                    className="px-2 py-2 text-center font-medium text-muted-foreground whitespace-nowrap min-w-[72px]"
                  >
                    <span className="text-xs">{label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dailyMarketingMetrics.map((metric, i) => (
                <tr
                  key={metric.name}
                  className={`transition-colors hover:bg-muted/30 ${
                    metric.isTotal
                      ? "border-t-2 border-t-border border-b border-border/50 bg-muted/20"
                      : `border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/10"}`
                  }`}
                >
                  <td className={`sticky left-0 z-10 backdrop-blur-sm px-4 py-3 border-r border-border/50 whitespace-nowrap ${
                    metric.isTotal
                      ? "bg-muted/40 font-bold text-foreground"
                      : "bg-card/95 font-medium text-foreground"
                  }`}>
                    {metric.name}
                  </td>
                  <td className={`px-3 py-3 text-right font-mono text-sm whitespace-nowrap ${
                    metric.isTotal ? "font-semibold text-foreground" : "text-foreground/80"
                  }`}>
                    {metric.monthlyTarget}
                  </td>
                  <td className={`px-3 py-3 text-right font-mono text-sm whitespace-nowrap border-r border-border/30 ${
                    metric.isTotal ? "font-semibold text-muted-foreground" : "text-muted-foreground"
                  }`}>
                    {metric.projection}
                  </td>
                  {metric.dailyValues.map((val, di) => {
                    const colorClass = getCellColor(val, metric);
                    return (
                      <td
                        key={di}
                        className={`px-1 py-3 text-right font-mono text-sm min-w-[72px] ${colorClass}`}
                      >
                        <span className={
                          val === "—"
                            ? "text-muted-foreground/40"
                            : metric.isTotal ? "text-foreground font-semibold" : "text-foreground/80"
                        }>
                          {val}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}
