import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useFinance } from "@/hooks/use-finance";
import { Loader2, TrendingUp, AlertTriangle, XCircle, CreditCard, ArrowUpRight, ArrowDownRight } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

function getYearMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(month) - 1]} ${year.slice(2)}`;
}

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color = "text-foreground", trend,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType;
  color?: string; trend?: { value: string; up: boolean };
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="rounded-lg bg-muted p-2">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <div>
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend.up ? "text-emerald-500" : "text-red-500"}`}>
          {trend.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trend.value}
        </div>
      )}
    </div>
  );
}

// ── Tooltips ──────────────────────────────────────────────────────────────────

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{value: number; name: string; color: string}>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  );
}

function CountTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{value: number; name: string; color: string}>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function FinanceDashboard() {
  const { transactions, failedPayments, cancellationRequests, loading, error } = useFinance();

  // ── Derived stats ──────────────────────────────────────────────────────────

  const succeededTxns = useMemo(
    () => transactions.filter((t) => t.eventType === "charge.succeeded" || t.status === "Paid"),
    [transactions]
  );

  const currentMonthKey = getYearMonth(new Date().toISOString());

  const thisMonthRevenue = useMemo(
    () => succeededTxns
      .filter((t) => getYearMonth(t.paymentDate) === currentMonthKey)
      .reduce((sum, t) => sum + t.amount, 0),
    [succeededTxns, currentMonthKey]
  );

  const lastMonthKey = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return getYearMonth(d.toISOString());
  }, []);

  const lastMonthRevenue = useMemo(
    () => succeededTxns
      .filter((t) => getYearMonth(t.paymentDate) === lastMonthKey)
      .reduce((sum, t) => sum + t.amount, 0),
    [succeededTxns, lastMonthKey]
  );

  const revenueChange = lastMonthRevenue > 0
    ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : null;

  const thisMonthPaymentCount = useMemo(
    () => succeededTxns.filter((t) => getYearMonth(t.paymentDate) === currentMonthKey).length,
    [succeededTxns, currentMonthKey]
  );

  const openFailedPayments = useMemo(
    () => failedPayments.filter((f) => f.status !== "Paid" && f.status !== "Cancelled"),
    [failedPayments]
  );

  const pendingCancellations = useMemo(
    () => cancellationRequests.filter((c) => c.status !== "Cancellation Complete").length,
    [cancellationRequests]
  );

  // ── Monthly revenue (last 8 months) ───────────────────────────────────────

  const monthlyRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    succeededTxns.forEach((t) => {
      if (!t.paymentDate) return;
      const ym = getYearMonth(t.paymentDate);
      map[ym] = (map[ym] ?? 0) + t.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([ym, revenue]) => ({ month: formatYearMonth(ym), revenue }));
  }, [succeededTxns]);

  // ── Monthly cancellations ─────────────────────────────────────────────────

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

  // ── Cancellation reasons ───────────────────────────────────────────────────

  const cancellationReasons = useMemo(() => {
    const map: Record<string, number> = {};
    cancellationRequests.forEach((c) => {
      c.cancellationReason.forEach((r) => {
        map[r] = (map[r] ?? 0) + 1;
      });
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([reason, count]) => ({ reason, count }));
  }, [cancellationRequests]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading finance data…</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-sm text-red-500">Failed to load finance data: {error}</div>;
  }

  return (
    <div className="space-y-6">

      {/* ── Row 1: Stat Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Stripe Revenue (MTD)"
          value={fmt(thisMonthRevenue)}
          sub="Stripe / Payfunnels collected"
          icon={TrendingUp}
          color="text-emerald-500"
          trend={revenueChange !== null ? {
            value: `${revenueChange > 0 ? "+" : ""}${revenueChange}% vs last month`,
            up: revenueChange >= 0,
          } : undefined}
        />
        <StatCard
          label="Payments This Month"
          value={thisMonthPaymentCount.toString()}
          sub="Successful charges"
          icon={CreditCard}
          color="text-blue-500"
        />
        <StatCard
          label="Failed Payments"
          value={openFailedPayments.length.toString()}
          sub="Currently in dunning"
          icon={AlertTriangle}
          color="text-amber-500"
        />
        <StatCard
          label="Cancellation Requests"
          value={cancellationRequests.length.toString()}
          sub={`${pendingCancellations} pending review`}
          icon={XCircle}
          color="text-red-500"
        />
      </div>

      {/* ── Row 2: Revenue Chart ──────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Stripe Revenue Over Time</h3>
        <p className="text-xs text-muted-foreground mb-4">Monthly collected revenue via Stripe / Payfunnels (NZD, last 8 months)</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={monthlyRevenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} width={60} />
            <Tooltip content={<CurrencyTooltip />} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Row 3: Cancellations (chart + reasons combined) ──────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Cancellations</h3>
        <p className="text-xs text-muted-foreground mb-5">Monthly volume and top reasons</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Monthly bar chart */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3">Requests per month</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyCancellations} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="cancels" name="Cancellations" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Reasons horizontal bars */}
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
              {cancellationReasons.length === 0 && (
                <p className="text-xs text-muted-foreground">No data available</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Row 4: Failed Payments ────────────────────────────────────── */}
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
  );
}
