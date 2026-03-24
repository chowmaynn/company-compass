import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { weekConfigs, type Metric } from "@/data/scorecardData";
import { useScorecard } from "@/hooks/use-scorecard";
import { useCurrency, useStatusModal, useSelectedMonth } from "@/components/AppLayout";
import {
  DollarSign,
  TrendingUp,
  Eye,
  UserPlus,
  Phone,
  BarChart3,
  Activity,
  Target,
  Zap,
  Globe,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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


// ── Component ────────────────────────────────────────────────

type ModalFilter = "ahead" | "onTrack" | "behind" | "offTrack" | null;
// Modal state is now shared via useStatusModal() from AppLayout

export default function Dashboard() {
  const { selectedMonth } = useSelectedMonth();
  const { metrics: scorecardData, loading } = useScorecard(selectedMonth);
  const { convert, symbol } = useCurrency();
  const { activeFilter: activeModal, setActiveFilter: setActiveModal } = useStatusModal();

  // Helper for currency display
  const formatCurrency = (val: number | string | undefined) => {
    if (!val || val === "—") return "—";
    const n = parseNum(String(val));
    return n !== null ? `${symbol}${compactNumber(convert(n))}` : String(val);
  };


  const modalMetrics = useMemo((): Metric[] => {
    if (!activeModal) return [];
    if (activeModal === "ahead") return scorecardData.filter((m) => m.status === "light-green");
    if (activeModal === "onTrack") return scorecardData.filter((m) => m.status === "green");
    if (activeModal === "behind") return scorecardData.filter((m) => m.status === "yellow");
    if (activeModal === "offTrack") return scorecardData.filter((m) => m.status === "red");
    return scorecardData;
  }, [activeModal, scorecardData]);

  const modalTitle = activeModal === "ahead" ? "Ahead"
    : activeModal === "onTrack" ? "On Track"
    : activeModal === "behind" ? "Behind"
    : activeModal === "offTrack" ? "Off Track"
    : "";

  const modalAccent = activeModal === "ahead" ? { text: "text-status-light-green", bg: "bg-status-light-green/10", dot: "bg-status-light-green" }
    : activeModal === "onTrack" ? { text: "text-status-green", bg: "bg-status-green/10", dot: "bg-status-green" }
    : activeModal === "behind" ? { text: "text-status-yellow", bg: "bg-status-yellow/10", dot: "bg-status-yellow" }
    : activeModal === "offTrack" ? { text: "text-status-red", bg: "bg-status-red/10", dot: "bg-status-red" }
    : { text: "text-primary", bg: "bg-primary/10", dot: "bg-primary" };

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

const revPct = pctOfTarget(revenue?.monthlyActual ?? 0, revenue?.monthlyTarget ?? 0);
  const cashPct = pctOfTarget(cash?.monthlyActual ?? 0, cash?.monthlyTarget ?? 0);

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* ── Status Overview Row ─────────────────────────────── */}

      {/* Status cards moved to navbar */}

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
                {formatCurrency(revenue?.monthlyActual)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Target: {formatCurrency(revenue?.monthlyTarget)}</p>
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
                {formatCurrency(cash?.monthlyActual)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Target: {formatCurrency(cash?.monthlyTarget)}</p>
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

      {/* ── KPI Detail Modal ───────────────────────────────── */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setActiveModal(null)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

          {/* Panel */}
          <div
            className="relative bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${modalAccent.dot}`} />
                <h2 className={`text-base font-bold ${modalAccent.text}`}>{modalTitle}</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-medium">
                  {modalMetrics.length} KPI{modalMetrics.length !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_100px_80px_80px] gap-3 px-6 py-2.5 bg-muted/40 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span>KPI</span>
              <span>Department</span>
              <span className="text-right">Actual</span>
              <span className="text-right">Target</span>
              <span className="text-center">Status</span>
            </div>

            {/* Rows */}
            <div className="overflow-y-auto flex-1">
              {modalMetrics.map((m) => {
                const statusDot =
                  m.status === "green" || m.status === "light-green"
                    ? "bg-status-green"
                    : m.status === "yellow"
                    ? "bg-status-yellow"
                    : "bg-status-red";
                const statusLabel =
                  m.status === "green" || m.status === "light-green"
                    ? "On Track"
                    : m.status === "yellow"
                    ? "Behind"
                    : "Off Track";
                const statusText =
                  m.status === "green" || m.status === "light-green"
                    ? "text-status-green bg-status-green/10"
                    : m.status === "yellow"
                    ? "text-status-yellow bg-status-yellow/10"
                    : "text-status-red bg-status-red/10";

                return (
                  <div
                    key={m.name}
                    className="grid grid-cols-[1fr_100px_100px_80px_80px] gap-3 px-6 py-3 items-center border-b border-border/50 hover:bg-muted/20 transition-colors last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                      {m.owner && <p className="text-[10px] text-muted-foreground truncate">{m.owner}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">{m.department}</span>
                    <span className="text-sm font-semibold text-foreground text-right font-mono">
                      {String(m.monthlyActual)}
                    </span>
                    <span className="text-xs text-muted-foreground text-right font-mono">
                      {String(m.monthlyTarget)}
                    </span>
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusText}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

