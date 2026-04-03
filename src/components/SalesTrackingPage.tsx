import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SalesLeaderboard } from "@/components/SalesLeaderboard";
import { DateRangePicker, type DateRangeValue } from "@/components/DateRangePicker";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useCurrency } from "@/components/AppLayout";
import { fmtCurrency } from "@/lib/formatNumber";
import { formatDay } from "@/lib/dates";
import { fetchSalesTrackingRange, type SalesTrackingRow } from "@/lib/supabase-sales";
import { ChevronDown } from "lucide-react";
import { GRID, TICK, TOOLTIP_STYLE } from "@/lib/chart-theme";
import { LoadingDots } from "@/components/LoadingDots";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

type ChartMetric = "closes" | "calls_booked" | "calls_taken" | "cc" | "no_shows" | "cancellations" | "reschedules" | "show_rate" | "close_rate";

const CHART_METRICS: { value: ChartMetric; label: string; color: string; tooltipLabel: string }[] = [
  { value: "closes",        label: "Won Deals",     color: "#10b981", tooltipLabel: "Closes" },
  { value: "calls_booked",  label: "Calls Booked",  color: "#6366f1", tooltipLabel: "Booked" },
  { value: "calls_taken",   label: "Calls Taken",   color: "#3b82f6", tooltipLabel: "Taken" },
  { value: "show_rate",     label: "Show Rate",     color: "#8b5cf6", tooltipLabel: "Show %" },
  { value: "close_rate",    label: "Close Rate",    color: "#f59e0b", tooltipLabel: "Close %" },
  { value: "cc",            label: "Contract Value", color: "#10b981", tooltipLabel: "CC" },
  { value: "no_shows",      label: "No Shows",      color: "#ef4444", tooltipLabel: "No Shows" },
  { value: "cancellations", label: "Cancellations", color: "#ef4444", tooltipLabel: "Cancels" },
  { value: "reschedules",   label: "Reschedules",   color: "#eab308", tooltipLabel: "Reschedules" },
];

function aggregateDailyMetric(rows: SalesTrackingRow[], metric: ChartMetric) {
  const byDate = new Map<string, { booked: number; taken: number; closes: number; cc: number; no_shows: number; cancellations: number; reschedules: number }>();
  for (const r of rows) {
    const d = byDate.get(r.date) ?? { booked: 0, taken: 0, closes: 0, cc: 0, no_shows: 0, cancellations: 0, reschedules: 0 };
    d.booked += r.calls_booked;
    d.taken += r.calls_taken;
    d.closes += r.closes;
    d.cc += r.cc;
    d.no_shows += r.no_shows;
    d.cancellations += r.cancellations;
    d.reschedules += r.reschedules;
    byDate.set(r.date, d);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => {
      let value: number;
      switch (metric) {
        case "closes": value = d.closes; break;
        case "calls_booked": value = d.booked; break;
        case "calls_taken": value = d.taken; break;
        case "cc": value = d.cc; break;
        case "no_shows": value = d.no_shows; break;
        case "cancellations": value = d.cancellations; break;
        case "reschedules": value = d.reschedules; break;
        case "show_rate": value = d.booked > 0 ? Math.round((d.taken / d.booked) * 100) : 0; break;
        case "close_rate": value = d.taken > 0 ? Math.round((d.closes / d.taken) * 100) : 0; break;
      }
      return { date, value };
    });
}

function today() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}
function monthStart() {
  const d = today();
  return d.slice(0, 8) + "01";
}

interface RepSummary {
  rep_name: string;
  calls_booked: number;
  calls_taken: number;
  closes: number;
  cc: number;
  show_rate: number | null;
  close_rate: number | null;
}

function summariseRows(rows: SalesTrackingRow[]) {
  let calls_booked = 0, calls_taken = 0, closes = 0, cc = 0, no_shows = 0, cancellations = 0, reschedules = 0;
  const byRep = new Map<string, SalesTrackingRow[]>();
  for (const r of rows) {
    calls_booked += r.calls_booked;
    calls_taken += r.calls_taken;
    closes += r.closes;
    cc += r.cc;
    no_shows += r.no_shows;
    cancellations += r.cancellations;
    reschedules += r.reschedules;
    const arr = byRep.get(r.rep_name) ?? [];
    arr.push(r);
    byRep.set(r.rep_name, arr);
  }
  const show_rate = calls_booked > 0 ? Math.round((calls_taken / calls_booked) * 100) : 0;
  const close_rate = calls_taken > 0 ? Math.round((closes / calls_taken) * 100) : 0;

  const reps: RepSummary[] = [];
  for (const [rep_name, repRows] of byRep) {
    const rb = repRows.reduce((s, r) => s + r.calls_booked, 0);
    const rt = repRows.reduce((s, r) => s + r.calls_taken, 0);
    const rc = repRows.reduce((s, r) => s + r.closes, 0);
    const rcc = repRows.reduce((s, r) => s + r.cc, 0);
    reps.push({
      rep_name, calls_booked: rb, calls_taken: rt, closes: rc, cc: rcc,
      show_rate: rb > 0 ? Math.round((rt / rb) * 100) : null,
      close_rate: rt > 0 ? Math.round((rc / rt) * 100) : null,
    });
  }
  reps.sort((a, b) => b.close_rate! - a.close_rate!);

  return { calls_booked, calls_taken, closes, cc, no_shows, cancellations, reschedules, show_rate, close_rate, reps };
}

export function SalesTrackingPage() {
  const { convert, symbol } = useCurrency();
  // ── Top-level date range (controls KPIs, leaderboard, chart) ──
  const [range, setRange] = useState<DateRangeValue>({ start: "", end: "", startDate: "", endDate: "" });
  const rangeFrom = range.startDate || monthStart();
  const rangeTo = range.endDate || today();

  const { data: rangeRows, isLoading: rangeLoading } = useQuery({
    queryKey: ["sales-tracking-range", rangeFrom, rangeTo],
    queryFn: () => fetchSalesTrackingRange(rangeFrom, rangeTo),
    staleTime: 5 * 60 * 1000,
  });

  const [chartMetric, setChartMetric] = useState<ChartMetric>("closes");

  const summary = useMemo(() => summariseRows(rangeRows ?? []), [rangeRows]);
  const dailyChartData = useMemo(() => aggregateDailyMetric(rangeRows ?? [], chartMetric), [rangeRows, chartMetric]);
  const activeMetricConfig = CHART_METRICS.find((m) => m.value === chartMetric)!;

  // Map rep summaries to the shape SalesLeaderboard expects
  const leaderboardReps = useMemo(() => {
    const rowsByRep = new Map<string, SalesTrackingRow[]>();
    for (const r of rangeRows ?? []) {
      const arr = rowsByRep.get(r.rep_name) ?? [];
      arr.push(r);
      rowsByRep.set(r.rep_name, arr);
    }
    return summary.reps.map((r) => ({
      rep_name: r.rep_name,
      weeks: [],
      monthly: {
        calls_booked: r.calls_booked,
        calls_taken: r.calls_taken,
        closes: r.closes,
        cc: r.cc,
        no_shows: 0,
        cancellations: 0,
        reschedules: 0,
        show_rate: r.show_rate,
        close_rate: r.close_rate,
      },
      dailyRows: (rowsByRep.get(r.rep_name) ?? []).sort((a, b) => a.date.localeCompare(b.date)),
    }));
  }, [summary.reps, rangeRows ?? []]);

  return (
    <div className="space-y-6">
      {/* Date Range Picker */}
      <div className="flex justify-end">
        <DateRangePicker onChange={setRange} />
      </div>

      {/* KPI Bar */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 divide-x divide-white/[0.06]">
          <KPIStat label="CALLS BOOKED" value={summary.calls_booked} sub="Total booked" loading={rangeLoading} />
          <KPIStat label="CALLS TAKEN" value={summary.calls_taken} sub={`of ${summary.calls_booked} booked`} loading={rangeLoading} />
          <KPIStat label="SHOW RATE" value={`${summary.show_rate}%`} sub="Taken ÷ Booked" loading={rangeLoading} />
          <KPIStat label="CLOSES" value={summary.closes} sub="Deals closed" accent="text-status-green" loading={rangeLoading} />
          <KPIStat label="CONTRACT VALUE" value={fmtCurrency(convert(summary.cc), symbol)} sub="Total CC" accent="text-status-green" loading={rangeLoading} />
          <KPIStat label="NO SHOWS" value={summary.no_shows} sub="Didn't attend" accent="text-red-500" loading={rangeLoading} />
          <KPIStat label="CANCELLATIONS" value={summary.cancellations} sub="Cancelled calls" accent="text-red-500" loading={rangeLoading} />
          <KPIStat label="RESCHEDULES" value={summary.reschedules} sub="Rescheduled calls" accent="text-yellow-500" loading={rangeLoading} />
        </div>

        {/* Metric Chart — attached to KPI card */}
        <div className="border-t border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <select
                value={chartMetric}
                onChange={(e) => setChartMetric(e.target.value as ChartMetric)}
                className="appearance-none bg-transparent text-xs font-semibold text-muted-foreground uppercase tracking-widest pr-5 cursor-pointer hover:text-foreground transition-colors focus:outline-none"
              >
                {CHART_METRICS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          {rangeLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !dailyChartData.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data in this period</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={dailyChartData} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeMetricConfig.color} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={activeMetricConfig.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={chartMetric === "cc" ? (v: number) => `$${(v / 1000).toFixed(0)}k` : undefined} />
                <Tooltip cursor={false} contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Date: ${v}`} formatter={(v: number) => [chartMetric === "cc" ? fmtCurrency(convert(v), symbol) : chartMetric.endsWith("_rate") ? `${v}%` : v, activeMetricConfig.tooltipLabel]} />
                <Area type="monotone" dataKey="value" stroke={activeMetricConfig.color} strokeWidth={2.5} fill="url(#metricGrad)" dot={false} activeDot={{ r: 5, fill: activeMetricConfig.color }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <SalesLeaderboard reps={leaderboardReps} loading={rangeLoading} convert={convert} symbol={symbol} />

    </div>
  );
}

function KPIStat({
  label, value, sub, accent, loading,
}: {
  label: string;
  value: number | string;
  sub: string;
  accent?: string;
  loading?: boolean;
}) {
  return (
    <div className="p-5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-3xl font-bold ${accent ?? "text-foreground"}`}>
        {loading ? <LoadingDots /> : value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
