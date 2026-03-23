import { useCircleCharts } from "@/hooks/use-circle-charts";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const GRID = "hsl(220, 13%, 91%)";
const TICK = "hsl(220, 9%, 46%)";
const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid hsl(220, 13%, 91%)",
  borderRadius: "8px",
  color: "hsl(224, 71%, 4%)",
  fontSize: "12px",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
};

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card className="card-shadow">
      <CardContent className="p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function formatDay(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function CircleCharts() {
  const { memberGrowth, postActivity, spaceActivity, topPosts, activityBuckets, isLoading, isError } =
    useCircleCharts();

  if (isError) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-status-red">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">Failed to load Circle.so data</span>
      </div>
    );
  }

  const SPACE_COLORS = [
    "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899",
    "#f59e0b", "#10b981", "#14b8a6", "#f97316",
    "#64748b", "#84cc16",
  ];

  return (
    <div className="space-y-4">

      {/* ── Row 1: Member Growth + Post Activity ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <ChartCard title="New Members — Daily" sub="Last 30 days">
          {isLoading ? <LoadingState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={memberGrowth}>
                <defs>
                  <linearGradient id="memberGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDay}
                  tick={{ fontSize: 11, fill: TICK }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: TICK }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => `Date: ${v}`}
                  formatter={(v: number) => [v, "New members"]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#memberGrad)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Daily Post Activity" sub="Last 30 days">
          {isLoading ? <LoadingState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={postActivity} barSize={10}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDay}
                  tick={{ fontSize: 11, fill: TICK }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: TICK }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => `Date: ${v}`}
                  formatter={(v: number) => [v, "Posts"]}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Row 2: Space Activity + Member Activity ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <ChartCard title="Most Active Spaces" sub="By recent post volume">
          {isLoading ? <LoadingState /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={spaceActivity} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: TICK }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: TICK }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [v, "Posts"]}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {spaceActivity.map((_, i) => (
                    <Cell key={i} fill={SPACE_COLORS[i % SPACE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Member Activity" sub="Last seen — from 300 most recent members">
          {isLoading ? <LoadingState /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={activityBuckets} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: TICK }}
                  axisLine={{ stroke: GRID }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: TICK }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [v, "Members"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  <Cell fill="#10b981" />
                  <Cell fill="#6366f1" />
                  <Cell fill="#f59e0b" />
                  <Cell fill="#ef4444" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Row 3: Top Engaged Posts ──────────────────────── */}
      <ChartCard
        title="Top Engaged Posts"
        sub="Ranked by likes and comments"
      >
        {isLoading ? <LoadingState /> : topPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No engagement data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topPosts} layout="vertical" barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: TICK }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: TICK }}
                axisLine={false}
                tickLine={false}
                width={180}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="likes" name="Likes" fill="#3b82f6" radius={[0, 2, 2, 0]} stackId="a" />
              <Bar dataKey="comments" name="Comments" fill="#6366f1" radius={[0, 2, 2, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

    </div>
  );
}
