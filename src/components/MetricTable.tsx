import { type Metric } from "@/data/scorecardData";
import { StatusBadge } from "./StatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface MetricTableProps {
  metrics: Metric[];
}

export function MetricTable({ metrics }: MetricTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="sticky left-0 z-10 bg-muted/90 backdrop-blur-sm px-4 py-3 text-left font-semibold text-foreground min-w-[200px]">Metric</th>
            <th className="px-3 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">W1 Actual</th>
            <th className="px-3 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">W2 Actual</th>
            <th className="px-3 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">W3 Actual</th>
            <th className="px-3 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">W4 Actual</th>
            <th className="px-3 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Monthly</th>
            <th className="px-3 py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Target</th>
            <th className="px-3 py-3 text-center font-medium text-muted-foreground">Status</th>
            <th className="px-3 py-3 text-left font-medium text-muted-foreground">Owner</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric, i) => (
            <tr key={metric.name} className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
              <td className="sticky left-0 z-10 bg-card/95 backdrop-blur-sm px-4 py-3 font-medium text-foreground">
                <div className="flex items-center gap-2">
                  {metric.name}
                  {metric.description && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs">{metric.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </td>
              {metric.weeks.map((w, wi) => (
                <td key={wi} className="px-3 py-3 text-right font-mono text-sm text-foreground/80">
                  {String(w.actual)}
                </td>
              ))}
              <td className="px-3 py-3 text-right font-mono text-sm font-semibold text-foreground">
                {String(metric.monthlyActual)}
              </td>
              <td className="px-3 py-3 text-right font-mono text-sm text-muted-foreground">
                {String(metric.monthlyTarget)}
              </td>
              <td className="px-3 py-3 text-center">
                <StatusBadge status={metric.status} />
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
