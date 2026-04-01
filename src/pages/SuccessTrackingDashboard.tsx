import { useMemo } from "react";
import { useSuccessTracking } from "@/hooks/use-success-tracking";
import { Card, CardContent } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TrendingUp, Trophy, Users, DollarSign } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { fmtCurrency, fmtCurrencyShort } from "@/lib/formatNumber";

// ── Helpers ───────────────────────────────────────────────────

// Use shared fmtCurrency as fmtRevenue, fmtCurrencyShort as fmtRevenueShort
const fmtRevenue = fmtCurrency;
const fmtRevenueShort = fmtCurrencyShort;

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function monthKey(dateStr?: string, fallback?: string): string {
  const s = dateStr || fallback || "";
  if (!s) return "";
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch { return ""; }
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "short", year: "2-digit" });
}

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#3b82f6", "#a855f7", "#14b8a6", "#ef4444", "#84cc16", "#ec4899"];

import { StatCard } from "@/components/StatCard";

import { ChartTooltip } from "@/components/ChartTooltip";

// ── Main ──────────────────────────────────────────────────────

export default function SuccessTrackingDashboard() {
  const { wins, loading, error } = useSuccessTracking();

  // ── Derived data ───────────────────────────────────────────

  const monetaryWins = useMemo(() => wins.filter((w) => (w.fields["Final revenue (USD)"] ?? 0) > 0), [wins]);

  const totalRevenue = useMemo(
    () => monetaryWins.reduce((sum, w) => sum + (w.fields["Final revenue (USD)"] ?? 0), 0),
    [monetaryWins]
  );

  const revenueValues = useMemo(() => monetaryWins.map((w) => w.fields["Final revenue (USD)"] ?? 0), [monetaryWins]);
  const avgRevenue = revenueValues.length ? totalRevenue / revenueValues.length : 0;
  const medianRevenue = useMemo(() => median(revenueValues), [revenueValues]);

  const uniqueMembers = useMemo(() => {
    const names = new Set<string>();
    monetaryWins.forEach((w) => {
      const members = w.fields["Full Name (from Members)"] ?? [];
      members.forEach((m) => names.add(m));
    });
    return names.size;
  }, [monetaryWins]);

  // Monthly revenue trend
  const monthlyRevenue = useMemo(() => {
    const map: Record<string, { revenue: number; wins: number }> = {};
    wins.forEach((w) => {
      const key = monthKey(w.fields["Deal date"], w.createdTime);
      if (!key) return;
      if (!map[key]) map[key] = { revenue: 0, wins: 0 };
      map[key].revenue += w.fields["Final revenue (USD)"] ?? 0;
      map[key].wins += 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, label: monthLabel(key), revenue: v.revenue, wins: v.wins }));
  }, [wins]);

  // Solution type
  const solutionData = useMemo(() => {
    const map: Record<string, number> = {};
    wins.forEach((w) => {
      const s = w.fields["Solution type"] ?? "Other";
      map[s] = (map[s] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [wins]);

  // Industry (top 8)
  const industryData = useMemo(() => {
    const map: Record<string, number> = {};
    wins.forEach((w) => {
      const s = w.fields["Industry"] ?? "Not specified";
      map[s] = (map[s] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [wins]);

  // Acquisition method
  const acquisitionData = useMemo(() => {
    const map: Record<string, number> = {};
    wins.forEach((w) => {
      const s = w.fields["Acquisition method"] ?? "Not specified";
      map[s] = (map[s] ?? 0) + 1;
    });
    return Object.entries(map)
      .filter(([name]) => name !== "Not specified")
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [wins]);

  return (
    <DashboardShell loading={loading} error={error} loadingMessage="Loading success data\u2026">
    <div className="space-y-5">
      {/* ── Row 1: Stats ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue Generated"
          value={fmtRevenue(totalRevenue)}
          sub={`${monetaryWins.length} monetary wins`}
          icon={DollarSign}
          accent="text-emerald-600"
          gradient="bg-emerald-50/80"
          loading={loading}
        />
        <StatCard
          label="Total Approved Wins"
          value={wins.length.toLocaleString()}
          sub="CSM verified"
          icon={Trophy}
          accent="text-indigo-600"
          loading={loading}
        />
        <StatCard
          label="Avg Revenue per Win"
          value={fmtRevenue(Math.round(avgRevenue))}
          sub="Monetary wins only"
          icon={TrendingUp}
          accent="text-foreground"
          loading={loading}
        />
        <StatCard
          label="Members Generating Revenue"
          value={uniqueMembers.toString()}
          sub={`Median: ${fmtRevenue(medianRevenue)}/win`}
          icon={Users}
          accent="text-foreground"
          loading={loading}
        />
      </div>

      {/* ── Row 2: Revenue trend (full width) ───────────────── */}
      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Revenue Over Time</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Monthly revenue from approved wins</p>
            </div>
            <span className="text-xs font-mono text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-lg">
              {fmtRevenue(totalRevenue)} total
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={fmtRevenueShort} width={55} />
              <Tooltip cursor={false} content={<ChartTooltip formatter={(v) => fmtRevenue(v)} />} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Row 3: Wins/month + Solution type donut ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* Wins per month bar chart */}
        <Card className="border-border/50">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-0.5">Wins Per Month</h3>
            <p className="text-xs text-muted-foreground mb-4">Total approved wins over time</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyRevenue} barSize={16} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={false} content={<ChartTooltip formatter={(v) => `${v} wins`} />} />
                <Bar dataKey="wins" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Solution type donut */}
        <Card className="border-border/50">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-0.5">Solution Type</h3>
            <p className="text-xs text-muted-foreground mb-3">Distribution of win types</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={solutionData}
                  cx="35%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {solutionData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  cursor={false}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                  formatter={(val, name) => [`${val} wins`, name]}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 11, lineHeight: "20px", paddingLeft: 8 }}
                  formatter={(value, entry: { payload?: { value: number } }) => (
                    <span className="text-muted-foreground">{value} ({entry.payload?.value})</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Industry + Acquisition ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Industry horizontal bars */}
        <Card className="border-border/50">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-0.5">Wins by Industry</h3>
            <p className="text-xs text-muted-foreground mb-4">Top 8 industries</p>
            <div className="space-y-2.5">
              {industryData.map((item, i) => {
                const pct = Math.round((item.value / (industryData[0]?.value ?? 1)) * 100);
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">{item.name}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-foreground w-8 text-right shrink-0">{item.value}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Acquisition method donut */}
        <Card className="border-border/50">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-0.5">Acquisition Method</h3>
            <p className="text-xs text-muted-foreground mb-3">How members are winning clients</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={acquisitionData}
                  cx="40%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {acquisitionData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  cursor={false}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }}
                  formatter={(val, name) => [`${val} wins`, name]}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  iconType="circle"
                  iconSize={7}
                  formatter={(value, entry: { payload?: { value: number } }) => (
                    <span style={{ fontSize: 10, color: "#64748b" }}>{value} ({entry.payload?.value})</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

    </div>
    </DashboardShell>
  );
}
