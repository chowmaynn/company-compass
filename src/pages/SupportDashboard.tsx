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
import { fmtDuration, elapsed } from "@/lib/dates";

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
  const { tickets, openTickets, totalTickets, resolvedCount, openCount, trackerBreakdown, loading, error } = useIntercomTickets(range.start, range.end);

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

  // Open tickets already enriched and sorted by oldest first from hook
  const sortedOpenTickets = useMemo(() =>
    [...openTickets].sort((a, b) => a.created_at - b.created_at),
    [openTickets]
  );

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

      {/* ── Volume + Open Tickets ─────────────────────────── */}
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

        {/* ── Open Tickets — attached below chart ──────────── */}
        <div className="border-t border-border px-5 py-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Open Tickets</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loading ? "" : `${sortedOpenTickets.length} unresolved · sorted by oldest first`}
              </p>
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
          ) : sortedOpenTickets.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30 text-emerald-500" />
              <p className="text-sm">All tickets resolved</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {/* Header */}
              <div className="grid grid-cols-[1fr_120px_90px_90px] gap-3 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Contact & Issue</span>
                <span>Status</span>
                <span>Open For</span>
                <span>Updated</span>
              </div>

              {sortedOpenTickets.map((t) => {
                const stateLabel = t.ticket_state?.internal_label ?? "Unknown";
                const stateCategory = t.ticket_state?.category ?? "";
                const isWaiting = stateCategory === "waiting_on_customer";
                const isNew = stateCategory === "new";

                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-[1fr_120px_90px_90px] gap-3 items-center py-3 hover:bg-muted/20 transition-colors rounded"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{t.contactName}</p>
                        <span className="text-[10px] font-mono text-muted-foreground/50">#{t.ticket_id}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{t.firstMessage}</p>
                    </div>
                    <div>
                      {isWaiting ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Waiting
                        </span>
                      ) : isNew ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
                          New
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400">
                          {stateLabel}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">{elapsed(t.created_at)}</span>
                    <span className="text-xs font-mono text-muted-foreground">{elapsed(t.updated_at)}</span>
                  </div>
                );
              })}

              {sortedOpenTickets.length > 30 && (
                <div className="pt-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Showing 30 of {openCount} open tickets.{" "}
                    <a href="https://app.intercom.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      View all in Intercom →
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

    </div>
  );
}
