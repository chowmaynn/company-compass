import { type Metric, weekConfigs } from "@/data/scorecardData";
import { formatValue } from "@/lib/formatNumber";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface DepartmentChartsProps {
  metrics: Metric[];
}

function parseNumericValue(val: number | string): number | null {
  if (typeof val === "number") return val;
  // Try to parse strings like "3.7k", "1.02m", "49%", etc.
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

export function DepartmentCharts({ metrics }: DepartmentChartsProps) {
  // Only chart metrics that have numeric-parseable week data
  const chartableMetrics = metrics.filter((m) =>
    m.weeks.some((w) => parseNumericValue(w.actual) !== null)
  );

  if (chartableMetrics.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {chartableMetrics.map((metric) => {
        const data = metric.weeks.map((w, i) => ({
          week: `${weekConfigs[i].label} (${weekConfigs[i].dateLabel})`,
          Actual: parseNumericValue(w.actual) ?? 0,
          Projection: parseNumericValue(w.projection) ?? 0,
        }));

        return (
          <div
            key={metric.name}
            className="rounded-xl border border-border bg-card p-5"
          >
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              {metric.name}
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} barGap={2}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatValue(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--popover-foreground))",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => formatValue(value)}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px" }}
                />
                <Bar
                  dataKey="Actual"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Projection"
                  fill="hsl(var(--muted-foreground) / 0.4)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
