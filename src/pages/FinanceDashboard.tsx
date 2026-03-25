import { useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import { useFinance } from "@/hooks/use-finance";
import { Loader2, TrendingUp, Users, AlertTriangle, XCircle, CheckCircle2, ArrowUpRight, ArrowDownRight } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

const MONTH_ORDER = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthToNum(m: string): number {
  return MONTH_ORDER.indexOf(m);
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

const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

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

// ── Custom Tooltip ─────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{value: number; name: string; color: string}>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function FinanceDashboard() {
  const { transactions, members, failedPayments, cancellationRequests, recentCharges, loading, error } = useFinance();

  // ── Derived stats ──────────────────────────────────────────────────────────

  const activeMembers = useMemo(() => members.filter((m) => m.status === "active").length, [members]);

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

  const openFailedPayments = useMemo(
    () => failedPayments.filter((f) => f.status !== "Paid" && f.status !== "Cancelled"),
    [failedPayments]
  );

  // ── Monthly revenue (last 8 months) ───────────────────────────────────────

  const monthlyRevenue = useMemo(() => {
    const map: Record<string, number> = {};
    succeededTxns.forEach((t) => {
      const ym = getYearMonth(t.paymentDate);
      map[ym] = (map[ym] ?? 0) + t.amount;
    });
    const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    return sorted.slice(-8).map(([ym, revenue]) => ({
      month: formatYearMonth(ym),
      revenue,
    }));
  }, [succeededTxns]);

  // ── Subscription type breakdown ────────────────────────────────────────────

  const planBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    succeededTxns.forEach((t) => {
      const type = t.subscriptionType || "Other";
      map[type] = (map[type] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));
  }, [succeededTxns]);

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

  // ── Monthly cancellations ─────────────────────────────────────────────────

  const monthlyCancellations = useMemo(() => {
    const map: Record<string, number> = {};
    cancellationRequests.forEach((c) => {
      if (!c.dateOfSubmission) return;
      const ym = c.dateOfSubmission.slice(0, 7);
      map[ym] = (map[ym] ?? 0) + 1;
    });
    const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    return sorted.slice(-8).map(([ym, cancels]) => ({
      month: formatYearMonth(ym),
      cancels,
    }));
  }, [cancellationRequests]);

  // ── Revenue + cancellations merged ────────────────────────────────────────

  const combinedMonthly = useMemo(() => {
    const revenueMap: Record<string, number> = {};
    monthlyRevenue.forEach((m) => { revenueMap[m.month] = m.revenue; });
    const cancelMap: Record<string, number> = {};
    monthlyCancellations.forEach((m) => { cancelMap[m.month] = m.cancels; });
    const allMonths = [...new Set([...monthlyRevenue.map((m) => m.month), ...monthlyCancellations.map((m) => m.month)])];
    return allMonths.map((month) => ({
      month,
      revenue: revenueMap[month] ?? 0,
      cancels: cancelMap[month] ?? 0,
    })).slice(-8);
  }, [monthlyRevenue, monthlyCancellations]);

  // ── Recent charges (Stripe) ───────────────────────────────────────────────

  const recentStripeCharges = useMemo(
    () => recentCharges.slice(0, 15),
    [recentCharges]
  );

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
          label="Active Members"
          value={activeMembers.toString()}
          sub={`${members.length} total records`}
          icon={Users}
          color="text-blue-500"
        />
        <StatCard
          label="This Month's Revenue"
          value={fmt(thisMonthRevenue)}
          sub="Succeeded charges"
          icon={TrendingUp}
          color="text-emerald-500"
          trend={revenueChange !== null ? {
            value: `${revenueChange > 0 ? "+" : ""}${revenueChange}% vs last month`,
            up: revenueChange >= 0,
          } : undefined}
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
          sub={`${cancellationRequests.filter((c) => c.status !== "Cancellation Complete").length} pending`}
          icon={XCircle}
          color="text-red-500"
        />
      </div>

      {/* ── Row 2: Revenue Chart ──────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Revenue Over Time</h3>
        <p className="text-xs text-muted-foreground mb-4">Monthly collected revenue (NZD, last 8 months)</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={combinedMonthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} width={60} />
            <Tooltip content={<ChartTooltip />} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Row 3: Plan Breakdown + Monthly Cancellations ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Plan Breakdown donut */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Payment Type Breakdown</h3>
          <p className="text-xs text-muted-foreground mb-4">By subscription type (last 12 months)</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={planBreakdown}
                cx="40%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {planBreakdown.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                iconSize={8}
                formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>}
              />
              <Tooltip
                formatter={(value, name) => [value, name]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)", background: "var(--popover)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Cancellations bar */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Monthly Cancellations</h3>
          <p className="text-xs text-muted-foreground mb-4">Cancellation requests submitted per month</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyCancellations} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="cancels" name="Cancellations" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 4: Recent Transactions + Failed Payments ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Stripe recent charges */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Recent Transactions</h3>
          <p className="text-xs text-muted-foreground mb-4">Latest charges from Stripe</p>
          <div className="space-y-0 divide-y divide-border">
            {recentStripeCharges.map((charge) => (
              <div key={charge.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">
                    {charge.description?.replace(/^AAA Accelerator - /, "").replace(/^AAA /, "") || "Charge"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(charge.created * 1000).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  <span className="text-xs font-semibold text-foreground">
                    {charge.currency.toUpperCase() === "NZD" ? "" : charge.currency.toUpperCase() + " "}
                    ${charge.amount.toLocaleString()}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    charge.status === "succeeded"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-red-500/10 text-red-600"
                  }`}>
                    {charge.status === "succeeded"
                      ? <CheckCircle2 className="h-2.5 w-2.5" />
                      : <XCircle className="h-2.5 w-2.5" />}
                    {charge.status}
                  </span>
                </div>
              </div>
            ))}
            {recentStripeCharges.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">No recent charges</p>
            )}
          </div>
        </div>

        {/* Failed payments table */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Failed Payments</h3>
          <p className="text-xs text-muted-foreground mb-4">Members currently in dunning</p>
          <div className="space-y-0 divide-y divide-border max-h-[360px] overflow-y-auto">
            {openFailedPayments.slice(0, 20).map((fp) => (
              <div key={fp.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{fp.customer}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {fp.subscriptionPlan ? `Plan: $${fp.subscriptionPlan}` : "Unknown plan"}
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

      {/* ── Row 5: Cancellation Reasons ────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Cancellation Reasons</h3>
        <p className="text-xs text-muted-foreground mb-4">Top reasons members have cancelled</p>
        <div className="space-y-3">
          {cancellationReasons.map((r, i) => {
            const max = cancellationReasons[0]?.count ?? 1;
            const pct = Math.round((r.count / max) * 100);
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-48 shrink-0 truncate" title={r.reason}>{r.reason}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-foreground w-6 text-right">{r.count}</span>
              </div>
            );
          })}
          {cancellationReasons.length === 0 && (
            <p className="text-xs text-muted-foreground">No cancellation data available</p>
          )}
        </div>
      </div>

    </div>
  );
}
