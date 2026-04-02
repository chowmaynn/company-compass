import { type Metric, weekConfigs } from "@/data/scorecardData";
import { StatusBadge } from "./StatusBadge";
import { EditableCell } from "./EditableCell";
import { formatValue } from "@/lib/formatNumber";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import React from "react";

interface MetricTableProps {
  metrics: Metric[];
  onMetricChange?: (metricName: string, field: string, value: number | string) => void;
  readOnlyMetrics?: Set<string>;
  /** When set, multiplies all numeric values by this rate (NZD→USD conversion) */
  currencyRate?: number;
  /** Per-metric edit check. If provided, overrides onMetricChange for metrics where this returns false. */
  canEditMetric?: (metric: Metric) => boolean;
}

export function MetricTable({ metrics, onMetricChange, readOnlyMetrics, currencyRate, canEditMetric }: MetricTableProps) {
  const convert = (val: number | string | ""): number | string | "" => {
    if (!currencyRate || val === "" || val === "—") return val;
    if (typeof val === "number") return Math.round(val * currencyRate);
    // Try to parse string numbers (e.g. "676889" or "$3,675,000")
    const cleaned = String(val).replace(/[$,]/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return Math.round(num * currencyRate);
    return val;
  };
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          {/* Group headers */}
          <tr className="border-b border-border bg-muted/50">
            <th rowSpan={2} className="sticky left-0 z-10 bg-muted/90 backdrop-blur-sm px-4 py-2 text-left font-semibold text-foreground min-w-[200px] border-r border-border/50">
              Metric
            </th>
            <th colSpan={2} className="px-1 py-2 text-center font-semibold text-foreground border-r border-border/30">
              <div className="flex flex-col items-center">
                <span className="text-xs text-muted-foreground">Catch-Up</span>
              </div>
            </th>
            {weekConfigs.map((wc) => (
              <th key={wc.label} colSpan={2} className="px-1 py-2 text-center font-semibold text-foreground border-r border-border/30">
                <div className="flex flex-col items-center">
                  <span>{wc.label}</span>
                  <span className="text-[10px] font-normal text-muted-foreground">{wc.dateLabel}</span>
                </div>
              </th>
            ))}
            <th rowSpan={2} className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">Monthly</th>
            <th rowSpan={2} className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">Target</th>
            <th rowSpan={2} className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
            <th rowSpan={2} className="px-3 py-2 text-left font-medium text-muted-foreground">Owner</th>
          </tr>
          {/* Sub-headers: Actual / Target */}
          <tr className="border-b border-border bg-muted/30">
            <th className="px-2 py-1.5 text-right text-xs font-bold text-foreground whitespace-nowrap">
              Actual
            </th>
            <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground/40 whitespace-nowrap bg-muted border-r border-border/50">
              Target
            </th>
            {weekConfigs.map((wc) => (
              <React.Fragment key={`${wc.label}-sub`}>
                <th className="px-2 py-1.5 text-right text-xs font-bold text-foreground whitespace-nowrap">
                  Actual
                </th>
                <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground/40 whitespace-nowrap bg-muted border-r border-border/50">
                  Target
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric, i) => {
            const isReadOnly = readOnlyMetrics?.has(metric.name) || (canEditMetric && !canEditMetric(metric));
            return (
            <tr key={metric.name} className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
              <td className="sticky left-0 z-10 bg-card/95 backdrop-blur-sm px-4 py-3 font-medium text-foreground border-r border-border/50">
                <div className="flex items-center gap-2">
                  {metric.name}
                  {metric.description && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="inline-flex">
                          <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">{metric.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </td>
              {/* Catch-Up columns */}
              <td className="px-1 py-2 text-right min-w-[70px]">
                {isReadOnly ? (
                  <span className={`block rounded px-1.5 py-0.5 font-mono text-sm ${
                    String(convert(metric.catchUp.actual)) === "—" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400/70" : "text-foreground"
                  }`}>
                    {formatValue(convert(metric.catchUp.actual))}
                  </span>
                ) : (
                  <EditableCell
                    value={convert(metric.catchUp.actual)}
                    onChange={currencyRate ? undefined : (val) => onMetricChange?.(metric.name, "catchUp.actual", val)}
                  />
                )}
              </td>
              <td className="px-1 py-2 text-right bg-muted border-r border-border/50 min-w-[70px]">
                <EditableCell
                  value={convert(metric.catchUp.projection)}
                  isProjection
                  onChange={isReadOnly || currencyRate ? undefined : (val) => onMetricChange?.(metric.name, "catchUp.projection", val)}
                />
              </td>
              {metric.weeks.map((w, wi) => {
                return (
                  <React.Fragment key={wi}>
                    <td className="px-1 py-2 text-right min-w-[70px]">
                      {isReadOnly ? (
                        <span className={`block rounded px-1.5 py-0.5 font-mono text-sm ${
                          String(convert(w.actual)) === "—" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400/70" : "text-foreground"
                        }`}>
                          {formatValue(convert(w.actual))}
                        </span>
                      ) : (
                        <EditableCell
                          value={convert(w.actual)}
                          onChange={currencyRate ? undefined : (val) => onMetricChange?.(metric.name, `weeks.${wi}.actual`, val)}
                        />
                      )}
                    </td>
                    <td className="px-1 py-2 text-right bg-muted border-r border-border/50 min-w-[70px]">
                      <EditableCell
                        value={convert(w.projection)}
                        isProjection
                        onChange={isReadOnly || currencyRate ? undefined : (val) => onMetricChange?.(metric.name, `weeks.${wi}.projection`, val)}
                      />
                    </td>
                  </React.Fragment>
                );
              })}
              <td className="px-3 py-3 text-right min-w-[80px]">
                {readOnlyMetrics?.has(metric.name) ? (
                  <span className="block px-1.5 py-0.5 font-mono text-sm text-foreground/80">
                    {formatValue(convert(metric.monthlyActual))}
                  </span>
                ) : (
                  <EditableCell
                    value={convert(metric.monthlyActual)}
                    onChange={currencyRate ? undefined : (val) => onMetricChange?.(metric.name, "monthlyActual", val)}
                  />
                )}
              </td>
              <td className="px-3 py-3 text-right min-w-[80px]">
                <EditableCell
                  value={convert(metric.monthlyTarget)}
                  isProjection
                  onChange={isReadOnly || currencyRate ? undefined : (val) => onMetricChange?.(metric.name, "monthlyTarget", val)}
                />
              </td>
              <td className="px-3 py-3 text-center">
                <StatusBadge status={metric.status} />
              </td>
              <td className="px-3 py-3 text-sm text-muted-foreground">
                {metric.owner}
              </td>
            </tr>
          );
          })}
        </tbody>
      </table>
    </div>
  );
}
