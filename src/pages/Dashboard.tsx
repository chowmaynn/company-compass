import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { scorecardData, departments, weekConfigs, type Department } from "@/data/scorecardData";
import { formatValue } from "@/lib/formatNumber";
import {
  DollarSign,
  TrendingUp,
  Users,
  Eye,
  UserPlus,
  Phone,
  BarChart3,
  ArrowUpRight,
  Activity,
  Target,
  Zap,
  Globe,
  Video,
  Megaphone,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";

// ── Helpers ──────────────────────────────────────────────────

function parseNum(val: number | string): number | null {
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/,/g, "").replace(/\$/g, "").trim();
  if (cleaned === "—" || cleaned === "") return null;
  if (cleaned.endsWith("%")) return parseFloat(cleaned) || null;
  if (cleaned.endsWith("k")) { const n = parseFloat(cleaned); return isNaN(n) ? null : n * 1000; }
  if (cleaned.endsWith("m")) { const n = parseFloat(cleaned); return isNaN(n) ? null : n * 1000000; }
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function pctOfTarget(actual: number | string, target: number | string): number | null {
  const a = parseNum(actual);
  const t = parseNum(target);
  if (a === null || t === null || t === 0) return null;
  return Math.round((a / t) * 100);
}

const deptIcons: Record<Department, React.ElementType> = {
  Finance: DollarSign,
  Content: Video,
  Marketing: Megaphone,
  Sales: Phone,
  Product: Users,
};

const deptColors: Record<Department, string> = {
  Finance: "bg-blue-50",
  Content: "bg-indigo-50",
  Marketing: "bg-amber-50",
  Sales: "bg-emerald-50",
  Product: "bg-violet-50",
};


// ── Component ────────────────────────────────────────────────

export default function Dashboard() {
  const statusSummary = useMemo(() =>
    scorecardData.reduce(
      (acc, m) => {
        if (m.status === "green" || m.status === "light-green") acc.onTrack++;
        else if (m.status === "yellow") acc.atRisk++;
        else acc.offTrack++;
        acc.total++;
        return acc;
      },
      { onTrack: 0, atRisk: 0, offTrack: 0, total: 0 }
    ), []
  );

  const revenue = scorecardData.find((m) => m.name === "Revenue");
  const cash = scorecardData.find((m) => m.name === "Cash Collected");
  const ytViews = scorecardData.find((m) => m.name === "YouTube views");
  const ytSubs = scorecardData.find((m) => m.name === "New YouTube subscribers");
  const totalBookings = scorecardData.find((m) => m.name === "Total Bookings");
  const closingRate = scorecardData.find((m) => m.name === "Closing Call Close Rate");
  const complaints = scorecardData.find((m) => m.name === "Customer support complaints");
  const websiteViews = scorecardData.find((m) => m.name === "Website Views");

  // Revenue weekly trend data
  const revenueWeekly = revenue?.weeks.map((w, i) => ({
    week: weekConfigs[i].label,
    actual: parseNum(w.actual) ?? 0,
    projection: parseNum(w.projection) ?? 0,
  })) ?? [];

  // Pie chart data for status distribution
  const pieData = [
    { name: "On Track", value: statusSummary.onTrack, fill: "hsl(160, 72%, 42%)" },
    { name: "At Risk", value: statusSummary.atRisk, fill: "hsl(42, 95%, 55%)" },
    { name: "Off Track", value: statusSummary.offTrack, fill: "hsl(0, 75%, 55%)" },
  ];

  const revPct = pctOfTarget(revenue?.monthlyActual ?? 0, revenue?.monthlyTarget ?? 0);
  const cashPct = pctOfTarget(cash?.monthlyActual ?? 0, cash?.monthlyTarget ?? 0);

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-pink-blue flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight gradient-text">Mission Terminal</h1>
              <p className="text-xs text-muted-foreground font-mono">
                COMPANY OVERVIEW — MARCH 2026
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-green/15 px-3 py-1 text-xs font-medium text-status-green">
            <span className="h-1.5 w-1.5 rounded-full bg-status-green animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* ── Status Overview Row ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-status-green/30 bg-status-green/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-status-green/15 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-status-green" />
            </div>
            <div>
              <p className="text-2xl font-bold text-status-green">{statusSummary.onTrack}</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">On Track</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-status-yellow/30 bg-status-yellow/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-status-yellow/15 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-status-yellow" />
            </div>
            <div>
              <p className="text-2xl font-bold text-status-yellow">{statusSummary.atRisk}</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">At Risk</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-status-red/30 bg-status-red/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-status-red/15 flex items-center justify-center">
              <XCircle className="h-5 w-5 text-status-red" />
            </div>
            <div>
              <p className="text-2xl font-bold text-status-red">{statusSummary.offTrack}</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Off Track</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{statusSummary.total}</p>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Total KPIs</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Financial Overview + Revenue Chart ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Card */}
        <Card className="lg:col-span-1 border-primary/20 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-5 pb-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Revenue</span>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">
                ${typeof revenue?.monthlyActual === "number" ? compactNumber(revenue.monthlyActual) : revenue?.monthlyActual}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Target: {revenue?.monthlyTarget}</p>
              {revPct !== null && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Progress</span>
                    <span className={`font-mono font-semibold ${revPct >= 80 ? "text-status-green" : revPct >= 50 ? "text-status-yellow" : "text-status-red"}`}>{revPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${revPct >= 80 ? "bg-status-green" : revPct >= 50 ? "bg-status-yellow" : "bg-status-red"}`}
                      style={{ width: `${Math.min(revPct, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="border-t border-border/50 p-5 pt-3">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-accent" />
                </div>
                <span className="text-sm font-medium text-muted-foreground">Cash Collected</span>
              </div>
              <p className="text-3xl font-bold tracking-tight text-foreground">
                ${typeof cash?.monthlyActual === "number" ? compactNumber(cash.monthlyActual) : cash?.monthlyActual}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Target: {cash?.monthlyTarget}</p>
              {cashPct !== null && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Progress</span>
                    <span className={`font-mono font-semibold ${cashPct >= 80 ? "text-status-green" : cashPct >= 50 ? "text-status-yellow" : "text-status-red"}`}>{cashPct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${cashPct >= 80 ? "bg-status-green" : cashPct >= 50 ? "bg-status-yellow" : "bg-status-red"}`}
                      style={{ width: `${Math.min(cashPct, 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Revenue Weekly Trend */}
        <Card className="lg:col-span-2 border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Weekly Revenue Trend</h3>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Actual
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Projection
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={revenueWeekly}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" vertical={false} />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }}
                  axisLine={{ stroke: "hsl(220, 13%, 91%)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${compactNumber(v)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid hsl(220, 13%, 91%)",
                    borderRadius: "8px",
                    color: "hsl(224, 71%, 4%)",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
                  }}
                  formatter={(value: number) => [`$${compactNumber(value)}`, undefined]}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke="hsl(221, 83%, 53%)"
                  strokeWidth={2.5}
                  fill="url(#revGradient)"
                  dot={{ r: 4, fill: "hsl(221, 83%, 53%)", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
                <Area
                  type="monotone"
                  dataKey="projection"
                  name="Projection"
                  stroke="hsl(220, 9%, 70%)"
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  fill="transparent"
                  dot={{ r: 3, fill: "hsl(220, 9%, 70%)", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Key Metrics Grid ───────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Key Performance Indicators</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard
            icon={Eye}
            label="YouTube Views"
            value={String(ytViews?.monthlyActual ?? "—")}
            target={`Target: ${ytViews?.monthlyTarget}`}
            status={ytViews?.status ?? "green"}
          />
          <KPICard
            icon={UserPlus}
            label="New Subscribers"
            value={String(ytSubs?.monthlyActual ?? "—")}
            target={`Target: ${ytSubs?.monthlyTarget}`}
            status={ytSubs?.status ?? "green"}
          />
          <KPICard
            icon={Phone}
            label="Total Bookings"
            value={String(totalBookings?.monthlyActual ?? "—")}
            target={`Target: ${totalBookings?.monthlyTarget}`}
            status={totalBookings?.status ?? "green"}
          />
          <KPICard
            icon={Globe}
            label="Website Views"
            value={String(websiteViews?.monthlyActual || "—")}
            target={`Target: ${websiteViews?.monthlyTarget}`}
            status={websiteViews?.status ?? "green"}
          />
          <KPICard
            icon={Target}
            label="Close Rate"
            value={String(closingRate?.monthlyActual ?? "—")}
            target={`Target: 30%`}
            status={closingRate?.status ?? "green"}
          />
          <KPICard
            icon={ShieldCheck}
            label="Complaints"
            value={String(complaints?.monthlyActual ?? "—")}
            target={`Target: <${complaints?.monthlyTarget}`}
            status={complaints?.status ?? "green"}
            invertTrend
          />
        </div>
      </div>

      {/* ── Department Performance + Status Pie ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Department Performance</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {departments.map((dept) => {
              const deptMetrics = scorecardData.filter((m) => m.department === dept);
              const green = deptMetrics.filter((m) => m.status === "green" || m.status === "light-green").length;
              const yellow = deptMetrics.filter((m) => m.status === "yellow").length;
              const red = deptMetrics.filter((m) => m.status === "red").length;
              const Icon = deptIcons[dept];
              const healthPct = Math.round((green / deptMetrics.length) * 100);

              return (
                <Card key={dept} className="border-border overflow-hidden card-shadow">
                  <CardContent className="p-0">
                    <div className={`${deptColors[dept]} p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-foreground/70" />
                          <h3 className="font-semibold text-sm text-foreground">{dept}</h3>
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground">{deptMetrics.length} KPIs</span>
                      </div>
                      <div className="flex items-center gap-4 mb-3">
                        {green > 0 && (
                          <span className="flex items-center gap-1 text-xs font-medium text-status-green">
                            <span className="h-2 w-2 rounded-full bg-status-green" /> {green}
                          </span>
                        )}
                        {yellow > 0 && (
                          <span className="flex items-center gap-1 text-xs font-medium text-status-yellow">
                            <span className="h-2 w-2 rounded-full bg-status-yellow" /> {yellow}
                          </span>
                        )}
                        {red > 0 && (
                          <span className="flex items-center gap-1 text-xs font-medium text-status-red">
                            <span className="h-2 w-2 rounded-full bg-status-red" /> {red}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-background/50 overflow-hidden">
                          {green > 0 && <div className="h-full bg-status-green inline-block" style={{ width: `${(green / deptMetrics.length) * 100}%` }} />}
                          {yellow > 0 && <div className="h-full bg-status-yellow inline-block" style={{ width: `${(yellow / deptMetrics.length) * 100}%` }} />}
                          {red > 0 && <div className="h-full bg-status-red inline-block" style={{ width: `${(red / deptMetrics.length) * 100}%` }} />}
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-foreground/70">{healthPct}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Status Distribution Pie */}
        <Card className="border-border/50">
          <CardContent className="p-5 flex flex-col items-center justify-center h-full">
            <h3 className="text-sm font-semibold text-foreground mb-2 self-start">Status Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid hsl(220, 13%, 91%)",
                    borderRadius: "8px",
                    color: "hsl(224, 71%, 4%)",
                    fontSize: "12px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2">
              {pieData.map((d) => (
                <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.fill }} />
                  {d.name} ({d.value})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Sales Funnel ───────────────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <Phone className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Sales Funnel — March 2026</h3>
          </div>
          <SalesFunnel />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function KPICard({
  icon: Icon,
  label,
  value,
  target,
  status,
  invertTrend: _invertTrend,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  target: string;
  status: string;
  invertTrend?: boolean;
}) {
  const borderColor =
    status === "green" || status === "light-green"
      ? "border-status-green/25"
      : status === "yellow"
      ? "border-status-yellow/25"
      : "border-status-red/25";

  return (
    <Card className={`${borderColor} card-shadow transition-shadow hover:card-shadow-md`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className={`h-2 w-2 rounded-full ${
            status === "green" || status === "light-green"
              ? "bg-status-green"
              : status === "yellow"
              ? "bg-status-yellow"
              : "bg-status-red"
          }`} />
        </div>
        <p className="text-xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">{target}</p>
      </CardContent>
    </Card>
  );
}

function SalesFunnel() {
  const triageCalls = scorecardData.find((m) => m.name === "Triage Calls Booked");
  const triageShowRate = scorecardData.find((m) => m.name === "Triage Show Rate");
  const triageQualRate = scorecardData.find((m) => m.name === "Triage Qualification Rate");
  const closingCalls = scorecardData.find((m) => m.name === "Closing Calls Booked");
  const closingShowRate = scorecardData.find((m) => m.name === "Closing Call Show Rate");
  const closingCallsTaken = scorecardData.find((m) => m.name === "Closing Calls Taken");
  const closeRate = scorecardData.find((m) => m.name === "Closing Call Close Rate");

  const funnelSteps = [
    { label: "Triage Calls Booked", value: triageCalls?.monthlyActual || "—", target: triageCalls?.monthlyTarget, status: triageCalls?.status },
    { label: "Triage Show Rate", value: triageShowRate?.monthlyActual || "—", target: triageShowRate?.monthlyTarget || "70%", status: triageShowRate?.status },
    { label: "Qualification Rate", value: triageQualRate?.monthlyActual || "—", target: triageQualRate?.monthlyTarget || "50%", status: triageQualRate?.status },
    { label: "Closing Calls Booked", value: closingCalls?.monthlyActual || "—", target: closingCalls?.monthlyTarget, status: closingCalls?.status },
    { label: "Closing Show Rate", value: closingShowRate?.monthlyActual || "—", target: closingShowRate?.monthlyTarget || "80%", status: closingShowRate?.status },
    { label: "Calls Taken", value: closingCallsTaken?.monthlyActual || "—", target: closingCallsTaken?.monthlyTarget, status: closingCallsTaken?.status },
    { label: "Close Rate", value: closeRate?.monthlyActual || "—", target: closeRate?.monthlyTarget || "30%", status: closeRate?.status },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      {funnelSteps.map((step, i) => {
        const statusBg =
          step.status === "green" || step.status === "light-green"
            ? "bg-status-green/10 border-status-green/20"
            : step.status === "yellow"
            ? "bg-status-yellow/10 border-status-yellow/20"
            : "bg-status-red/10 border-status-red/20";

        return (
          <div key={step.label} className="flex items-center gap-2">
            <div className={`flex-1 rounded-xl border p-3 text-center ${statusBg}`}>
              <p className="text-lg font-bold text-foreground">{formatValue(step.value)}</p>
              <p className="text-[10px] font-medium text-muted-foreground mt-1 leading-tight">{step.label}</p>
              {step.target && (
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">Target: {formatValue(step.target)}</p>
              )}
            </div>
            {i < funnelSteps.length - 1 && (
              <ArrowUpRight className="h-3 w-3 text-muted-foreground/40 shrink-0 hidden lg:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}
