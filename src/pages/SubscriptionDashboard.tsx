import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LabelList,
} from "recharts";
import { useFinance } from "@/hooks/use-finance";
import {
  Loader2, AlertTriangle, XCircle, CreditCard, RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { DashboardShell } from "@/components/DashboardShell";
import { DateRangePicker, presetToRange, rangeToStrings, type DateRangeValue } from "@/components/DateRangePicker";
import { useCurrency } from "@/components/AppLayout";
import { formatYearMonth } from "@/lib/dates";
import { fmtCurrency } from "@/lib/formatNumber";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getYearMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// (Date range handled by shared DateRangePicker component)

// ── Components ────────────────────────────────────────────────────────────────

import { StatCard } from "@/components/StatCard";

import { ChartTooltip } from "@/components/ChartTooltip";

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function SubscriptionDashboard() {
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
    {/* ── Date range filter (outside DashboardShell so it persists during loading) */}
    <div className="flex items-center gap-2 mb-6">
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
              {s ? `${cfmt(s.grossVolume)}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">via Stripe / Payfunnels</p>
            {s && s.dailyVolume.length > 0 && (
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={s.dailyVolume} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip content={<ChartTooltip formatter={(v, name) => `${name}: ${fmtCurrency(v)}`} />} />
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
              {s ? `${cfmt(s.netVolume)}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">after Stripe fees</p>
            {s && s.dailyVolume.length > 0 && (
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={s.dailyVolume} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip content={<ChartTooltip formatter={(v, name) => `${name}: ${fmtCurrency(v)}`} />} />
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
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </div>
          )}
        </div>

        </div>
      </Card>

      {/* ── Full daily volume chart ───────────────────────────────────── */}
      {s && s.dailyVolume.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Daily Volume</h3>
          <p className="text-xs text-muted-foreground mb-4">Gross vs Net ({currencyLabel})</p>
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
              <Tooltip content={<ChartTooltip formatter={(v, name) => `${name}: ${fmtCurrency(v)}`} />} />
              <Area type="monotone" dataKey="gross" name="Gross" stroke="#8b5cf6" strokeWidth={2} fill="url(#g2)" dot={false} />
              <Area type="monotone" dataKey="net" name="Net" stroke="#10b981" strokeWidth={2} fill="url(#n2)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Stat Cards row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Failed Payments"
          value={openFailedPayments.length.toString()}
          sub="Currently in dunning"
          icon={AlertTriangle}
          accent="text-amber-500"
        />
        <StatCard
          label="Cancellation Requests"
          value={cancellationRequests.length.toString()}
          sub={`${pendingCancellations} pending review`}
          icon={XCircle}
          accent="text-red-500"
        />
        <StatCard
          label="New Customers"
          value={s ? s.newCustomers.toString() : "—"}
          sub="Selected period"
          icon={CreditCard}
          accent="text-blue-500"
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
    </>
  );
}
