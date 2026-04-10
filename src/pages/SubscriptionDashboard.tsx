import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, LabelList, ComposedChart, Line,
} from "recharts";
import { useFinance } from "@/hooks/use-finance";
import { useFinanceOverview, type FinanceMonthly } from "@/hooks/use-finance-overview";
import {
  Loader2, AlertTriangle, XCircle, CreditCard, RefreshCw,
  TrendingUp, DollarSign, Users, BarChart3, ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { LoadingDots } from "@/components/LoadingDots";
import { DashboardShell } from "@/components/DashboardShell";
import { DateRangePicker, presetToRange, rangeToStrings, type DateRangeValue } from "@/components/DateRangePicker";
import { useCurrency } from "@/components/AppLayout";
import { formatYearMonth } from "@/lib/dates";
import { fmtCurrency } from "@/lib/formatNumber";
import { GRID, TICK, TOOLTIP_STYLE as CHART_TOOLTIP } from "@/lib/chart-theme";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getYearMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// (Date range handled by shared DateRangePicker component)

// ── Components ────────────────────────────────────────────────────────────────

import { ChartTooltip } from "@/components/ChartTooltip";

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function SubscriptionDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "subscriptions">("overview");
  const { convert, symbol, label: currencyLabel } = useCurrency();
  const cfmt = (n: number) => fmtCurrency(convert(n), symbol);

  const [dateRange, setDateRange] = useState<DateRangeValue>(() => {
    const { from, to } = presetToRange("TW");
    return rangeToStrings(from, to);
  });
  // Round to day boundaries so query keys are stable across remounts
  const startTs = useMemo(() => {
    if (!dateRange.startDate) return Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);
    const d = new Date(dateRange.startDate + "T00:00:00");
    return Math.floor(d.getTime() / 1000);
  }, [dateRange.startDate]);
  const endTs = useMemo(() => {
    if (!dateRange.endDate) return Math.floor(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).getTime() / 1000);
    const d = new Date(dateRange.endDate + "T23:59:59");
    return Math.floor(d.getTime() / 1000);
  }, [dateRange.endDate]);
  const { transactions, failedPayments, cancellationRequests, stripeOverview, loading, stripeLoading, error } = useFinance(startTs, endTs);

  // ── Airtable-derived stats ─────────────────────────────────────────────────

  const succeededTxns = useMemo(
    () => transactions.filter((t) => t.eventType === "charge.succeeded" || t.status === "Paid"),
    [transactions]
  );

  const openFailedPayments = useMemo(
    () => failedPayments.filter((f) => f.status !== "Paid" && f.status !== "Cancelled"),
    [failedPayments]
  );

  const pendingCancellations = useMemo(
    () => cancellationRequests.filter((c) => c.status !== "Cancellation Complete").length,
    [cancellationRequests]
  );

  const monthlyCancellations = useMemo(() => {
    const map: Record<string, number> = {};
    cancellationRequests.forEach((c) => {
      if (!c.dateOfSubmission) return;
      const ym = c.dateOfSubmission.slice(0, 7);
      map[ym] = (map[ym] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([ym, cancels]) => ({ month: formatYearMonth(ym), cancels }));
  }, [cancellationRequests]);

  const cancellationReasons = useMemo(() => {
    const map: Record<string, number> = {};
    cancellationRequests.forEach((c) => {
      c.cancellationReason.forEach((r) => { map[r] = (map[r] ?? 0) + 1; });
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([reason, count]) => ({ reason, count }));
  }, [cancellationRequests]);

  // ── Render ────────────────────────────────────────────────────────────────

  const s = stripeOverview;

  return (
    <>
    {/* ── Tabs ──────────────────────────────────────────────── */}
    <div className="flex gap-1 border-b border-border mb-6">
      {[
        { key: "overview", label: "Overview" },
        { key: "subscriptions", label: "Subscriptions" },
      ].map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setActiveTab(key as typeof activeTab)}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>

    {/* ── Overview Tab ──────────────────────────────────────── */}
    {activeTab === "overview" && (
      <FinancialOverview convert={convert} symbol={symbol} />
    )}

    {/* ── Subscriptions Tab ─────────────────────────────────── */}
    {activeTab === "subscriptions" && <>

    {/* ── Date range filter */}
    <div className="flex items-center justify-end gap-2 mb-6">
      <DateRangePicker onChange={setDateRange} />
      {stripeLoading && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
    </div>

    <DashboardShell loading={loading} error={error} loadingMessage="Loading finance data\u2026">
    <div className="space-y-6">

      {/* ── Stripe: Gross + Net + Payments ───────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="flex flex-col lg:flex-row">

          {/* Gross Volume */}
          <div className="flex-1 p-5 lg:border-r border-white/[0.06]">
            <p className="text-xs text-muted-foreground font-medium mb-1">Gross Volume</p>
            <p className="text-2xl font-bold text-foreground">
              {s ? `${cfmt(s.grossVolume)}` : stripeLoading ? <LoadingDots /> : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">via Stripe / Payfunnels</p>
            {s && s.dailyVolume.length > 1 && (
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={s.dailyVolume} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip cursor={false} content={<ChartTooltip formatter={(v, name) => `${name}: ${fmtCurrency(v)}`} />} />
                    <Area type="monotone" dataKey="gross" name="Gross" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#grossGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Net Volume */}
          <div className="flex-1 p-5 border-t lg:border-t-0 lg:border-r border-white/[0.06]">
            <p className="text-xs text-muted-foreground font-medium mb-1">Net Volume</p>
            <p className="text-2xl font-bold text-foreground">
              {s ? `${cfmt(s.netVolume)}` : stripeLoading ? <LoadingDots /> : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">after Stripe fees</p>
            {s && s.dailyVolume.length > 1 && (
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={s.dailyVolume} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip cursor={false} content={<ChartTooltip formatter={(v, name) => `${name}: ${fmtCurrency(v)}`} />} />
                    <Area type="monotone" dataKey="net" name="Net" stroke="#10b981" strokeWidth={1.5} fill="url(#netGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Payments breakdown */}
          <div className="flex-1 p-5 border-t lg:border-t-0">
          <p className="text-xs text-muted-foreground font-medium mb-3">Payments</p>
          {s ? (
            <>
              {/* Stacked bar */}
              <div className="flex h-2 rounded-full overflow-hidden mb-4 gap-px">
                {[
                  { val: s.succeeded, color: "bg-emerald-500" },
                  { val: s.refunded, color: "bg-cyan-400" },
                  { val: s.blocked,  color: "bg-amber-400" },
                  { val: s.failed,   color: "bg-red-500" },
                ].map(({ val, color }, i) => {
                  const total = s.succeeded + s.refunded + s.blocked + s.failed || 1;
                  return <div key={i} className={`${color} rounded-sm`} style={{ width: `${(val / total) * 100}%` }} />;
                })}
              </div>
              <div className="space-y-2">
                {[
                  { label: "Succeeded", val: s.succeeded, dot: "bg-emerald-500" },
                  { label: "Refunded",  val: s.refunded,  dot: "bg-cyan-400" },
                  { label: "Blocked",   val: s.blocked,   dot: "bg-amber-400" },
                  { label: "Failed",    val: s.failed,    dot: "bg-red-500" },
                ].map(({ label, val, dot }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${dot}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground">{cfmt(val)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-2xl font-bold"><LoadingDots /></p>
          )}
        </div>

        </div>
      </Card>

      {/* ── Full daily volume chart ───────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Daily Volume</h3>
          <p className="text-xs text-muted-foreground mb-4">Gross vs Net ({currencyLabel})</p>
          <div style={{ height: 220 }}>
            {!s || stripeLoading ? (
              <div className="flex items-center justify-center h-full"><LoadingDots /></div>
            ) : s.dailyVolume.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={s.dailyVolume} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="n2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => cfmt(v)} width={60} />
                  <Tooltip cursor={false} content={<ChartTooltip formatter={(v, name) => `${name}: ${fmtCurrency(v)}`} />} />
                  <Area type="monotone" dataKey="gross" name="Gross" stroke="#8b5cf6" strokeWidth={2} fill="url(#g2)" dot={false} />
                  <Area type="monotone" dataKey="net" name="Net" stroke="#10b981" strokeWidth={2} fill="url(#n2)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      {/* ── Stat Cards row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Failed Payments"
          value={openFailedPayments.length.toString()}
          sub="Currently in dunning"
          icon={AlertTriangle}
          accent="text-amber-500"
          loading={loading}
        />
        <StatCard
          label="Cancellation Requests"
          value={cancellationRequests.length.toString()}
          sub={`${pendingCancellations} pending review`}
          icon={XCircle}
          accent="text-red-500"
          loading={loading}
        />
        <StatCard
          label="New Customers"
          value={s ? s.newCustomers.toString() : "—"}
          sub="Selected period"
          icon={CreditCard}
          accent="text-blue-500"
          loading={stripeLoading}
        />
      </div>

      {/* ── Cancellations combined card ───────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Cancellations</h3>
        <p className="text-xs text-muted-foreground mb-5">Monthly volume and top reasons</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3">Requests per month</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyCancellations} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Bar dataKey="cancels" name="Cancellations" fill="#ef4444" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="cancels" position="inside" fill="#fff" fontSize={12} fontWeight={600} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3">Top reasons</p>
            <div className="space-y-3 pt-1">
              {cancellationReasons.map((r, i) => {
                const max = cancellationReasons[0]?.count ?? 1;
                const pct = Math.round((r.count / max) * 100);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-44 shrink-0 truncate" title={r.reason}>{r.reason}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-red-500/70 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-5 text-right">{r.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Failed Payments table ─────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Failed Payments</h3>
        <p className="text-xs text-muted-foreground mb-4">Members currently in dunning</p>
        <div className="divide-y divide-border max-h-[320px] overflow-y-auto">
          {openFailedPayments.slice(0, 25).map((fp) => (
            <div key={fp.id} className="flex items-center justify-between py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{fp.customer}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {fp.subscriptionPlan ? `$${fp.subscriptionPlan}` : "Unknown plan"}
                  {fp.email ? ` · ${fp.email}` : ""}
                </p>
              </div>
              <span className={`ml-3 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                fp.status === "Warning 1" ? "bg-amber-500/10 text-amber-600"
                : fp.status === "Warning 2" ? "bg-orange-500/10 text-orange-600"
                : "bg-red-500/10 text-red-600"
              }`}>
                {fp.status || "Overdue"}
              </span>
            </div>
          ))}
          {openFailedPayments.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">No failed payments</p>
          )}
        </div>
      </div>

    </div>
    </DashboardShell>
    </>}
    </>
  );
}

// ── Financial Overview Component ─────────────────────────────────────────────

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split("-");
  const names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(mo)]} ${y.slice(2)}`;
}

function FinancialOverview({ convert, symbol }: { convert: (v: number) => number; symbol: string }) {
  const { data, loading } = useFinanceOverview();
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Available months from data
  const months = useMemo(() => data.map((d) => d.month), [data]);

  // Default to latest month
  const activeMonth = selectedMonth || months[0] || "";
  const selected = useMemo(() => data.find((d) => d.month === activeMonth) ?? data[0], [data, activeMonth]);

  // Chart data — sorted oldest first
  const chartData = useMemo(() =>
    [...data].reverse().map((d) => ({
      month: fmtMonth(d.month),
      revenue: d.revenue ?? 0,
      cogs: d.cogs ?? 0,
      grossMargin: d.gross_margin_pct ?? 0,
    })),
    [data]
  );

  return (
    <div className="space-y-6 mb-6">
      {/* ── Month Selector ──────────────────────────────────── */}
      {months.length > 0 && (
        <div className="flex items-center justify-end mb-4">
          <div className="relative inline-flex items-center gap-2 bg-muted rounded-lg px-4 py-2 cursor-pointer hover:bg-muted/80 transition-colors">
            <select
              value={activeMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-transparent text-sm font-semibold text-foreground cursor-pointer focus:outline-none pr-5"
            >
              {months.map((m) => (
                <option key={m} value={m}>{fmtMonth(m)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Revenue"
          value={loading ? <LoadingDots /> : selected?.revenue != null ? `${symbol}${compact(convert(selected.revenue))}` : "—"}
          sub={selected ? fmtMonth(selected.month) : ""}
          icon={DollarSign}
          accent="text-emerald-600"
          bg="bg-emerald-50 dark:bg-emerald-950/40"
        />
        <StatCard
          label="Cost of Goods"
          value={loading ? <LoadingDots /> : selected?.cogs != null ? `${symbol}${compact(convert(selected.cogs))}` : "—"}
          sub={selected?.cogs != null && selected?.revenue ? `${((selected.cogs / selected.revenue) * 100).toFixed(1)}% of revenue` : ""}
          icon={BarChart3}
          accent="text-amber-600"
          bg="bg-amber-50 dark:bg-amber-950/40"
        />
        <StatCard
          label="Gross Margin"
          value={loading ? <LoadingDots /> : selected?.gross_margin_pct != null ? `${selected.gross_margin_pct.toFixed(1)}%` : "—"}
          sub={selected?.gross_margin_pct != null && selected.gross_margin_pct >= 85 ? "Healthy" : selected?.gross_margin_pct != null && selected.gross_margin_pct >= 70 ? "Moderate" : "Low"}
          icon={TrendingUp}
          accent={selected?.gross_margin_pct != null && selected.gross_margin_pct >= 85 ? "text-emerald-600" : selected?.gross_margin_pct != null && selected.gross_margin_pct >= 70 ? "text-amber-600" : "text-red-600"}
          bg={selected?.gross_margin_pct != null && selected.gross_margin_pct >= 85 ? "bg-emerald-50 dark:bg-emerald-950/40" : selected?.gross_margin_pct != null && selected.gross_margin_pct >= 70 ? "bg-amber-50 dark:bg-amber-950/40" : "bg-red-50 dark:bg-red-950/40"}
        />
        <StatCard
          label="Revenue / Employee"
          value={loading ? <LoadingDots /> : selected?.revenue_per_employee != null ? `${symbol}${compact(convert(selected.revenue_per_employee))}` : "—"}
          sub={selected?.headcount != null ? `${selected.headcount} employees` : ""}
          icon={Users}
          accent="text-blue-600"
          bg="bg-blue-50 dark:bg-blue-950/40"
        />
      </div>

      {/* ── Revenue & Cost of Goods Trend Chart ────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Revenue & Cost of Goods Trend</h3>
          <p className="text-xs text-muted-foreground mb-4">Monthly · Gross Margin % on right axis</p>
          {loading ? (
            <div className="flex items-center justify-center py-16"><LoadingDots /></div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: TICK }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${compact(v)}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: TICK }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} domain={[50, 100]} />
                <Tooltip contentStyle={CHART_TOOLTIP} formatter={(v: number, name: string) => [name === "grossMargin" ? `${v.toFixed(1)}%` : `$${compact(v)}`, name === "revenue" ? "Revenue" : name === "cogs" ? "Cost of Goods" : "Gross Margin"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
                <Bar yAxisId="left" dataKey="cogs" name="Cost of Goods" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={20} opacity={0.7} />
                <Line yAxisId="right" type="monotone" dataKey="grossMargin" name="Gross Margin" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: "#6366f1" }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Monthly Detail Table ──────────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Breakdown</h3>
          {loading ? (
            <div className="flex items-center justify-center py-12"><LoadingDots /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Month</th>
                    <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Revenue</th>
                    <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">CoGs</th>
                    <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Coaching</th>
                    <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Subs</th>
                    <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Margin</th>
                    <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cost Ratio</th>
                    <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">HC</th>
                    <th className="text-right py-2 px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rev/Emp</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((d) => (
                    <tr key={d.month} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">{fmtMonth(d.month)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-foreground">{d.revenue != null ? `${symbol}${compact(convert(d.revenue))}` : "—"}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-500">{d.cogs != null ? `${symbol}${compact(convert(d.cogs))}` : "—"}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{d.coaching_contractors != null ? `${symbol}${compact(convert(d.coaching_contractors))}` : "—"}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{d.subscriptions != null ? `${symbol}${compact(convert(d.subscriptions))}` : "—"}</td>
                      <td className={`py-2.5 px-3 text-right font-mono font-semibold ${(d.gross_margin_pct ?? 0) >= 85 ? "text-emerald-500" : (d.gross_margin_pct ?? 0) >= 70 ? "text-amber-500" : "text-red-500"}`}>{d.gross_margin_pct != null ? `${d.gross_margin_pct.toFixed(1)}%` : "—"}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">{d.product_cost_ratio_pct != null ? `${d.product_cost_ratio_pct.toFixed(1)}%` : "—"}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-foreground">{d.headcount ?? "—"}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-500">{d.revenue_per_employee != null ? `${symbol}${compact(convert(d.revenue_per_employee))}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
