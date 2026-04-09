import { useMemo, useState } from "react";
import { useIntercomTickets, type TrackerBreakdown } from "@/hooks/use-intercom";
import { TRACKER_TYPES } from "@/lib/intercom";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker, type DateRangeValue } from "@/components/DateRangePicker";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  MessageSquare,
  Clock,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";

import { GRID, TICK } from "@/lib/chart-theme";
import { StatCard } from "@/components/StatCard";
import { LoadingDots } from "@/components/LoadingDots";
import { fmtDuration } from "@/lib/dates";

// ── Helpers ───────────────────────────────────────────────────

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

function dayKey(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

// ── Main ──────────────────────────────────────────────────────

export default function SupportDashboard() {
  const [range, setRange] = useState<DateRangeValue>({ start: "", end: "", startDate: "", endDate: "" });
  const { tickets, totalTickets, resolvedCount, openCount, trackerBreakdown, loading, error } = useIntercomTickets(range.start, range.end);

  // ── Derived stats ─────────────────────────────────────────

  const resolutionRate = useMemo(() => {
    if (!totalTickets) return null;
    return Math.round((resolvedCount / totalTickets) * 100);
  }, [resolvedCount, totalTickets]);

  // Daily ticket volume — fill all days in range
  const dailyVolume = useMemo(() => {
    if (!range.startDate || !range.endDate) return [];
    const map: Record<string, number> = {};
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      map[key] = 0;
    }
    tickets.forEach((t) => {
      const key = dayKey(t.created_at);
      if (key in map) map[key]++;
    });
    return Object.entries(map).map(([key, count]) => ({ key, label: dayLabel(key), count }));
  }, [tickets, range.startDate, range.endDate]);

  // Tracker donut data
  const donutData = useMemo(() =>
    trackerBreakdown.filter((t) => t.total > 0).map((t) => ({
      name: t.label,
      value: t.total,
      color: t.color,
    })),
    [trackerBreakdown]
  );

  const totalTrackerTickets = useMemo(() =>
    trackerBreakdown.reduce((s, t) => s + t.total, 0),
    [trackerBreakdown]
  );

  return (
    <div className="space-y-5">

      {/* ── Date range selector ─────────────────────────────── */}
      <div className="flex justify-end">
        <DateRangePicker defaultPreset="MTD" onChange={setRange} />
      </div>

      {/* ── Stats row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Support Tickets"
          value={loading ? <LoadingDots /> : totalTickets}
          sub={loading ? "" : `${resolvedCount} resolved · ${openCount} open`}
          icon={MessageSquare}
          accent="text-indigo-600"
          bg="bg-indigo-50 dark:bg-indigo-950/40"
        />
        <StatCard
          label="Resolution Rate"
          value={loading ? <LoadingDots /> : resolutionRate !== null ? `${resolutionRate}%` : "—"}
          sub="Resolved ÷ Total"
          icon={CheckCircle2}
          accent={
            resolutionRate === null ? "text-foreground"
            : resolutionRate >= 70 ? "text-emerald-600"
            : resolutionRate >= 50 ? "text-amber-600"
            : "text-red-600"
          }
          bg={
            resolutionRate === null ? "bg-muted"
            : resolutionRate >= 70 ? "bg-emerald-50 dark:bg-emerald-950/40"
            : resolutionRate >= 50 ? "bg-amber-50 dark:bg-amber-950/40"
            : "bg-red-50 dark:bg-red-950/40"
          }
        />
        <StatCard
          label="Tracker Tickets"
          value={loading ? <LoadingDots /> : totalTrackerTickets}
          sub="Billing · Cancel · General · Refund"
          icon={Clock}
          accent="text-blue-600"
          bg="bg-blue-50 dark:bg-blue-950/40"
        />

        {/* Tracker donut */}
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            {loading ? (
              <div className="flex items-center justify-center w-full py-4"><LoadingDots /></div>
            ) : donutData.length > 0 ? (
              <>
                <ResponsiveContainer width={80} height={80}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={22} outerRadius={36} paddingAngle={2} dataKey="value">
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1">
                  {donutData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-[11px]">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-mono font-semibold text-foreground">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center w-full py-4">No tracker data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Volume trend ───────────────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Support Ticket Volume</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Real support tickets per day</p>
            </div>
            <span className="text-xs font-mono text-indigo-600 font-semibold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 rounded-lg">
              {totalTickets} total
            </span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16"><LoadingDots /></div>
          ) : dailyVolume.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyVolume} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={false} contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, "Tickets"]} />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#volGrad)" dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
          )}
        </CardContent>
      </Card>

      {/* ── Tracker Breakdown Table ────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Tracker Breakdown</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Issue categorization via tracker tickets</p>
            </div>
            <a
              href="https://app.intercom.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
            >
              Open Intercom <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><LoadingDots /></div>
          ) : trackerBreakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                    <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                    <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">New</th>
                    <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">In Progress</th>
                    <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Waiting</th>
                    <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {trackerBreakdown.map((t) => (
                    <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                          <span className="font-medium text-foreground">{t.label}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-3 font-mono font-semibold text-foreground">{t.total}</td>
                      <td className="text-right py-3 px-3 font-mono text-muted-foreground">{t.states["new"] ?? 0}</td>
                      <td className="text-right py-3 px-3 font-mono text-muted-foreground">{t.states["in_progress"] ?? 0}</td>
                      <td className="text-right py-3 px-3 font-mono text-amber-500">{t.states["waiting_on_customer"] ?? 0}</td>
                      <td className="text-right py-3 px-3 font-mono text-emerald-500">{t.states["resolved"] ?? 0}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="bg-muted/30">
                    <td className="py-3 px-3 font-semibold text-foreground">Total</td>
                    <td className="text-right py-3 px-3 font-mono font-bold text-foreground">{totalTrackerTickets}</td>
                    <td className="text-right py-3 px-3 font-mono text-muted-foreground">{trackerBreakdown.reduce((s, t) => s + (t.states["new"] ?? 0), 0)}</td>
                    <td className="text-right py-3 px-3 font-mono text-muted-foreground">{trackerBreakdown.reduce((s, t) => s + (t.states["in_progress"] ?? 0), 0)}</td>
                    <td className="text-right py-3 px-3 font-mono text-amber-500">{trackerBreakdown.reduce((s, t) => s + (t.states["waiting_on_customer"] ?? 0), 0)}</td>
                    <td className="text-right py-3 px-3 font-mono text-emerald-500">{trackerBreakdown.reduce((s, t) => s + (t.states["resolved"] ?? 0), 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No tracker tickets in this period</p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
