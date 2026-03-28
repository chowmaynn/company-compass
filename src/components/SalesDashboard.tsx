import { useState } from "react";
import { useClose } from "@/hooks/use-close";
import { BookingsDashboard } from "@/components/BookingsDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { DateRangePicker, type DateRangeValue } from "@/components/DateRangePicker";
import { formatDay } from "@/lib/dates";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

import { GRID, TICK, TOOLTIP_STYLE } from "@/lib/chart-theme";

const STAGE_COLORS: Record<string, string> = {
  "Lead In":               "#94a3b8",
  "Call Booked":           "#3b82f6",
  "Call Completed":        "#6366f1",
  "Follow-up In Progress": "#f59e0b",
};

// ── Date helpers ─────────────────────────────────────────
// Date range handled by shared DateRangePicker component

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// (presetDates removed — using shared DateRangePicker)

// ── Sub-components ────────────────────────────────────────

/** Horizontal divided stat panel — replaces the card-per-metric grid */
function StatPanel({ items, loading }: {
  items: { label: string; value: string | number | null; sub?: string; accent?: string }[];
  loading?: boolean;
}) {
  return (
    <div className="grid divide-x divide-border bg-card rounded-2xl border border-border overflow-hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <div key={item.label} className="px-6 py-5">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{item.label}</p>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <p className={`text-3xl font-bold ${item.accent ?? "text-foreground"}`}>
              {item.value ?? "—"}
            </p>
          )}
          {item.sub && <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  );
}

// (DateFilter removed — using shared DateRangePicker)

// ── Main ──────────────────────────────────────────────────
export function SalesDashboard() {
  const {
    wonCount, lostCount, winRate,
    callsTotal, callsAnswered, showRate,
    dailyWins, pipelineStages,
    isLoading, isError,
  } = useClose();

  const [bookingsRange, setBookingsRange] = useState<DateRangeValue>({ start: "", end: "", startDate: "", endDate: "" });
  const from = bookingsRange.start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const to = bookingsRange.end || new Date().toISOString();

  if (isError) {
    return (
      <div className="flex items-center gap-2 py-16 text-status-red">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">Failed to load Close.com data</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── 1. Close.com KPIs ─────────────────────────────── */}
      <div>
        <SectionLabel dot="bg-emerald-500 animate-pulse" label="Close.com · This Month" />
        <StatPanel loading={isLoading} items={[
          { label: "Won",           value: wonCount,      sub: "Deals closed",            accent: wonCount > 0 ? "text-emerald-600" : undefined },
          { label: "Lost",          value: lostCount,     sub: "No-show + closed lost" },
          { label: "Win Rate",      value: winRate !== null ? `${winRate}%` : null, sub: "Won ÷ (Won + Lost)" },
          { label: "Calls Answered",value: callsAnswered, sub: `of ${callsTotal} logged` },
          { label: "Show Rate",     value: showRate !== null ? `${showRate}%` : null, sub: "Answered ÷ total calls" },
        ]} />
      </div>

      {/* ── 2. Pipeline + Daily Wins ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Pipeline */}
        <Card className="card-shadow">
          <CardContent className="p-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Active Pipeline</p>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-4">
                {pipelineStages.map((stage, i) => {
                  const max = Math.max(...pipelineStages.map((s) => s.count));
                  const pct = Math.round((stage.count / max) * 100);
                  const color = STAGE_COLORS[stage.label] ?? "#94a3b8";
                  return (
                    <div key={stage.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: color }}>
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-foreground">{stage.label}</span>
                        </div>
                        <span className="text-sm font-bold text-foreground">{stage.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden ml-7">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Wins */}
        <Card className="card-shadow lg:col-span-2">
          <CardContent className="p-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Won Deals — Daily</p>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={dailyWins}>
                  <defs>
                    <linearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Date: ${v}`} formatter={(v: number) => [v, "Deals won"]} />
                  <Area type="monotone" dataKey="won" stroke="#10b981" strokeWidth={2.5} fill="url(#wonGrad)" dot={false} activeDot={{ r: 5, fill: "#10b981" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 3. Bookings ───────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <SectionLabel dot="bg-indigo-500 animate-pulse" label="Bookings" />
          <DateRangePicker onChange={setBookingsRange} />
        </div>
        <BookingsDashboard from={from} to={to} showRate={showRate} />
      </div>

    </div>
  );
}
