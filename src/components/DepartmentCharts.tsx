import { useState } from "react";
import { type Metric, weekConfigs } from "@/data/scorecardData";
import { formatValue } from "@/lib/formatNumber";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, LineChart as LineChartIcon } from "lucide-react";

type ChartType = "bar" | "line";

interface DepartmentChartsProps {
  metrics: Metric[];
}

function parseNumericValue(val: number | string): number | null {
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/,/g, "").replace(/\$/g, "").trim();
  if (cleaned.endsWith("%")) {
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }
  if (cleaned.endsWith("k")) {
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n * 1000;
  }
  if (cleaned.endsWith("m")) {
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n * 1000000;
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

const sharedAxisProps = {
  xAxis: {
    dataKey: "week" as const,
    tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
    axisLine: { stroke: "hsl(var(--border))" },
    tickLine: false as const,
  },
  yAxis: {
    tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
    axisLine: false as const,
    tickLine: false as const,
  },
  tooltip: {
    contentStyle: {
      backgroundColor: "hsl(var(--popover))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "8px",
      color: "hsl(var(--popover-foreground))",
      fontSize: "12px",
    },
  },
};

export function DepartmentCharts({ metrics }: DepartmentChartsProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");

  const chartableMetrics = metrics.filter((m) =>
    m.weeks.some((w) => parseNumericValue(w.actual) !== null)
  );

  if (chartableMetrics.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setChartType("bar")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            chartType === "bar"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Bar
        </button>
        <button
          onClick={() => setChartType("line")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            chartType === "line"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LineChartIcon className="h-3.5 w-3.5" />
          Line
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {chartableMetrics.map((metric) => {
          const data = metric.weeks.map((w, i) => ({
            week: `${weekConfigs[i].label} (${weekConfigs[i].dateLabel})`,
            Actual: parseNumericValue(w.actual) ?? 0,
            Projection: parseNumericValue(w.projection) ?? 0,
          }));

          return (
            <div key={metric.name} className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">{metric.name}</h3>
              <ResponsiveContainer width="100%" height={220}>
                {chartType === "bar" ? (
                  <BarChart data={data} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis {...sharedAxisProps.xAxis} />
                    <YAxis {...sharedAxisProps.yAxis} tickFormatter={(v) => formatValue(v)} />
                    <Tooltip {...sharedAxisProps.tooltip} formatter={(value: number) => formatValue(value)} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="Actual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Projection" fill="hsl(var(--muted-foreground) / 0.4)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis {...sharedAxisProps.xAxis} />
                    <YAxis {...sharedAxisProps.yAxis} tickFormatter={(v) => formatValue(v)} />
                    <Tooltip {...sharedAxisProps.tooltip} formatter={(value: number) => formatValue(value)} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Line
                      type="monotone"
                      dataKey="Actual"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Projection"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ r: 3, fill: "hsl(var(--muted-foreground))", strokeWidth: 0 }}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}
