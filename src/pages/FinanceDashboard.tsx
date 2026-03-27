import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useFinance } from "@/hooks/use-finance";
import {
  Loader2, TrendingUp, AlertTriangle, XCircle, CreditCard,
  ArrowUpRight, ArrowDownRight, RefreshCw,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toLocaleString()}`;
}

function getYearMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatYearMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(month) - 1]} ${year.slice(2)}`;
}

// ── Date Range Presets ────────────────────────────────────────────────────────

type Preset = "mtd" | "7d" | "30d" | "3m";

function getRange(preset: Preset): { startTs: number; endTs: number; label: string } {
  // Round to the nearest hour so remounts within the same hour hit the React Query cache
  const now = Math.floor(Date.now() / 1000 / 3600) * 3600;
  const d = new Date();
  switch (preset) {
    case "mtd": {
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      return { startTs: Math.floor(start.getTime() / 1000), endTs: now, label: "Month to date" };
    }
    case "7d":
      return { startTs: now - 7 * 86400, endTs: now, label: "Last 7 days" };
    case "30d":
      return { startTs: now - 30 * 86400, endTs: now, label: "Last 30 days" };
    case "3m":
      return { startTs: now - 90 * 86400, endTs: now, label: "Last 3 months" };
  }
}

// ── Components ────────────────────────────────────────────────────────────────

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
  const [preset, setPreset] = useState<Preset>("mtd");
  const range = useMemo(() => getRange(preset), [preset]);
  const { transactions, failedPayments, cancellationRequests, stripeOverview, loading, stripeLoading, error } = useFinance(range.startTs, range.endTs);

  const presets: { id: Preset; label: string }[] = [
    { id: "mtd", label: "MTD" },
    { id: "7d",  label: "7d" },
    { id: "30d", label: "30d" },
    { id: "3m",  label: "3m" },
  ];

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

  const s = stripeOverview;

  return (
    <div className="space-y-6">

      {/* ── Date range filter ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Date range</span>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                preset === p.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {stripeLoading && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
      </div>

      {/* ── Stripe: Gross + Net + Payments ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Gross Volume */}
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground font-medium mb-1">Gross Volume</p>
          <p className="text-2xl font-bold text-foreground">
            {s ? `NZ${fmt(s.grossVolume)}` : "—"}
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
                  <Tooltip content={<CurrencyTooltip />} />
                  <Area type="monotone" dataKey="gross" name="Gross" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#grossGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Net Volume */}
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs text-muted-foreground font-medium mb-1">Net Volume</p>
          <p className="text-2xl font-bold text-foreground">
            {s ? `NZ${fmt(s.netVolume)}` : "—"}
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
                  <Tooltip content={<CurrencyTooltip />} />
                  <Area type="monotone" dataKey="net" name="Net" stroke="#10b981" strokeWidth={1.5} fill="url(#netGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Payments breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
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
                    <span className="text-xs font-semibold text-foreground">NZ{fmt(val)}</span>
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

      {/* ── Full daily volume chart ───────────────────────────────────── */}
      {s && s.dailyVolume.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-1">Daily Volume</h3>
          <p className="text-xs text-muted-foreground mb-4">{range.label} — Gross vs Net (NZD)</p>
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} width={60} />
              <Tooltip content={<CurrencyTooltip />} />
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
          color="text-amber-500"
        />
        <StatCard
          label="Cancellation Requests"
          value={cancellationRequests.length.toString()}
          sub={`${pendingCancellations} pending review`}
          icon={XCircle}
          color="text-red-500"
        />
        <StatCard
          label="New Customers"
          value={s ? s.newCustomers.toString() : "—"}
          sub={range.label}
          icon={CreditCard}
          color="text-blue-500"
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
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="cancels" name="Cancellations" fill="#ef4444" radius={[4, 4, 0, 0]} />
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
  );
}
