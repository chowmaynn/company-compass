import { type Metric, type StatusColor, weekConfigs } from "@/data/scorecardData";
import { StatusBadge } from "./StatusBadge";
import { EditableCell } from "./EditableCell";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import React from "react";

interface MetricTableProps {
  metrics: Metric[];
  onMetricChange?: (metricName: string, field: string, value: number | string) => void;
  onStatusChange?: (metricName: string, status: StatusColor) => void;
}

export function MetricTable({ metrics, onMetricChange, onStatusChange }: MetricTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          {/* Group headers */}
          <tr className="border-b border-border bg-muted/50">
            <th rowSpan={2} className="sticky left-0 z-10 bg-muted/90 backdrop-blur-sm px-4 py-2 text-left font-semibold text-foreground min-w-[200px] border-r border-border/50">
              Metric
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
          {/* Sub-headers: Actual / Proj */}
          <tr className="border-b border-border bg-muted/30">
            {weekConfigs.map((wc) => (
              <React.Fragment key={`${wc.label}-sub`}>
                <th className="px-2 py-1.5 text-right text-xs font-medium text-foreground/70 whitespace-nowrap">
                  Actual
                </th>
                <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground/60 whitespace-nowrap bg-muted/40 border-r border-border/30">
                  Proj
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric, i) => (
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
              {metric.weeks.map((w, wi) => (
                <React.Fragment key={wi}>
                  <td className="px-1 py-2 text-right">
                    <EditableCell
                      value={w.actual}
                      onChange={(val) => onMetricChange?.(metric.name, `weeks.${wi}.actual`, val)}
                    />
                  </td>
                  <td className="px-1 py-2 text-right bg-muted/20 border-r border-border/20">
                    <EditableCell
                      value={w.projection}
                      isProjection
                      onChange={(val) => onMetricChange?.(metric.name, `weeks.${wi}.projection`, val)}
                    />
                  </td>
                </React.Fragment>
              ))}
              <td className="px-3 py-3 text-right">
                <EditableCell
                  value={metric.monthlyActual}
                  onChange={(val) => onMetricChange?.(metric.name, "monthlyActual", val)}
                />
              </td>
              <td className="px-3 py-3 text-right">
                <EditableCell
                  value={metric.monthlyTarget}
                  isProjection
                  onChange={(val) => onMetricChange?.(metric.name, "monthlyTarget", val)}
                />
              </td>
              <td className="px-3 py-3 text-center">
                <StatusBadge
                  status={metric.status}
                  editable
                  onChange={(newStatus) => onStatusChange?.(metric.name, newStatus)}
                />
              </td>
              <td className="px-3 py-3 text-sm text-muted-foreground">
                {metric.owner}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
