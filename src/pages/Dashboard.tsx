import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { weekConfigs } from "@/data/scorecardData";
import { useScorecard } from "@/hooks/use-scorecard";
import { useCurrency, useSelectedMonth } from "@/components/AppLayout";
import { fetchRevenueHistory, type ScorecardRow } from "@/lib/supabase-scorecard";
import { DollarSign, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { FunnelSankey } from "@/components/FunnelSankey";
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

export default function Dashboard() {
  const { selectedMonth } = useSelectedMonth();
  const { metrics: scorecardData, loading } = useScorecard(selectedMonth);
  const { convert, symbol } = useCurrency();
  // Helper for currency display
  const formatCurrency = (val: number | string | undefined) => {
    if (!val || val === "—") return "—";
    const n = parseNum(String(val));
    return n !== null ? `${symbol}${compactNumber(convert(n))}` : String(val);
  };


  const revenue = scorecardData.find((m) => m.name === "Revenue");
  const cash = scorecardData.find((m) => m.name === "Cash Collected");

  // Revenue weekly trend data (current month only — used as fallback)
  const revenueWeekly = revenue?.weeks.map((w, i) => ({
    week: weekConfigs[i].label,
    actual: parseNum(w.actual) ?? 0,
    projection: parseNum(w.projection) ?? 0,
  })) ?? [];

const revPct = pctOfTarget(revenue?.monthlyActual ?? 0, revenue?.monthlyTarget ?? 0);
  const cashPct = pctOfTarget(cash?.monthlyActual ?? 0, cash?.monthlyTarget ?? 0);

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* ── Welcome ───────────────────────────────────────── */}
      <WelcomeHeader />

      {/* ── Financial Overview + Revenue Chart (single card) ── */}
      <Card className="overflow-hidden" data-glass-padding="4px">
        <div className="flex flex-col lg:flex-row">
          {/* Left: Summary stats */}
          <div className="lg:w-[280px] shrink-0 lg:border-r border-white/[0.06]">
            <div className="p-5 pb-3">
              <span className="text-sm font-medium text-muted-foreground mb-2 block">Revenue</span>
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
            <div className="border-t border-white/[0.06] p-5 pt-3">
              <span className="text-sm font-medium text-muted-foreground mb-2 block">Cash Collected</span>
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
          </div>

          {/* Right: Revenue Trend chart */}
          <div className="flex-1 min-w-0">
            <RevenueTrendChart convert={convert} symbol={symbol} fallbackData={revenueWeekly} embedded />
          </div>
        </div>
      </Card>

      {/* ── Conversion Funnel ─────────────────────────────── */}
      <FunnelSankey metrics={scorecardData} formatCurrency={formatCurrency} />

    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────


// ── Revenue Trend Chart ──────────────────────────────────────

function WelcomeHeader() {
  const { user } = useAuth();
  const name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];

  return (
    <h1 className="text-2xl font-bold text-foreground">
      Welcome{name ? `, ${name}` : ""}
    </h1>
  );
}

type RevenueRange = "week" | "month" | "last-month" | "3m" | "6m" | "ytd" | "yoy";

const RANGE_LABELS: { id: RevenueRange; label: string }[] = [
  { id: "month", label: "This Month" },
  { id: "last-month", label: "Last Month" },
  { id: "3m", label: "3M" },
  { id: "6m", label: "6M" },
  { id: "ytd", label: "YTD" },
  { id: "yoy", label: "YOY" },
];

function getMonthsForRange(range: RevenueRange): string[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed

  const fmt = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const months: string[] = [];

  let startDate: Date;
  switch (range) {
    case "week":
    case "month":
      return [fmt(now)];
    case "last-month": {
      const prev = new Date(y, m - 1, 1);
      return [fmt(prev)];
    }
    case "3m":
      startDate = new Date(y, m - 2, 1);
      break;
    case "6m":
      startDate = new Date(y, m - 5, 1);
      break;
    case "ytd":
      startDate = new Date(y, 0, 1);
      break;
    case "yoy":
      startDate = new Date(y - 1, m, 1);
      break;
  }

  const currentMonth = fmt(now);
  const cursor = new Date(startDate);
  while (fmt(cursor) <= currentMonth) {
    months.push(fmt(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function flattenRevenueRows(
  rows: ScorecardRow[],
  range: RevenueRange
): { label: string; actual: number; projection: number }[] {
  const result: { label: string; actual: number; projection: number }[] = [];

  // Sort by month
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month));

  for (const row of sorted) {
    const [yr, mo] = row.month.split("-").map(Number);
    const monthLabel = new Date(yr, mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const weeks = [
      { actual: row.w1_actual, target: row.w1_target, label: "W1" },
      { actual: row.w2_actual, target: row.w2_target, label: "W2" },
      { actual: row.w3_actual, target: row.w3_target, label: "W3" },
      { actual: row.w4_actual, target: row.w4_target, label: "W4" },
    ];

    if (range === "week") {
      // Only show the current week
      const wi = getCurrentWeekIdx();
      if (wi >= 0 && wi < 4) {
        const w = weeks[wi];
        const a = parseNumSafe(w.actual);
        const p = parseNumSafe(w.target);
        if (a !== null) result.push({ label: `${w.label}`, actual: a, projection: p ?? 0 });
      }
    } else if (range === "month" || range === "last-month") {
      // Show all 4 weeks of the month
      for (const w of weeks) {
        const a = parseNumSafe(w.actual);
        if (a !== null) result.push({ label: `${w.label}`, actual: a, projection: parseNumSafe(w.target) ?? 0 });
      }
    } else {
      // Multi-month: show monthly totals
      const total = parseNumSafe(row.monthly_actual);
      const target = parseNumSafe(row.monthly_target);
      if (total !== null) {
        result.push({ label: monthLabel, actual: total, projection: target ?? 0 });
      }
    }
  }

  return result;
}

function parseNumSafe(val: string): number | null {
  if (!val || val === "—") return null;
  const cleaned = val.replace(/[$,]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function getCurrentWeekIdx(): number {
  const now = new Date();
  for (let i = weekConfigs.length - 1; i >= 0; i--) {
    if (now >= new Date(weekConfigs[i].start)) return i;
  }
  return -1;
}

function RevenueTrendChart({
  convert,
  symbol,
  fallbackData,
  embedded,
}: {
  convert: (n: number) => number;
  symbol: string;
  fallbackData: { week: string; actual: number; projection: number }[];
  embedded?: boolean;
}) {
  const [range, setRange] = useState<RevenueRange>("month");
  const [historyRows, setHistoryRows] = useState<ScorecardRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  const loadHistory = useCallback(async (r: RevenueRange) => {
    const months = getMonthsForRange(r);
    if (months.length <= 1 && (r === "month" || r === "week")) {
      setHistoryRows([]);
      return;
    }
    setHistLoading(true);
    const rows = await fetchRevenueHistory(months);
    setHistoryRows(rows);
    setHistLoading(false);
  }, []);

  useEffect(() => {
    loadHistory(range);
  }, [range, loadHistory]);

  const chartData = useMemo(() => {
    if (range === "month" && historyRows.length === 0) {
      // Use fallback from current scorecard
      return fallbackData.map((d) => ({
        label: d.week,
        actual: convert(d.actual),
        projection: convert(d.projection),
      }));
    }
    if (range === "week" && historyRows.length === 0) {
      // Single current week from fallback
      const wi = getCurrentWeekIdx();
      if (wi >= 0 && wi < fallbackData.length) {
        return [{ label: fallbackData[wi].week, actual: convert(fallbackData[wi].actual), projection: convert(fallbackData[wi].projection) }];
      }
      return [];
    }
    return flattenRevenueRows(historyRows, range).map((d) => ({
      ...d,
      actual: convert(d.actual),
      projection: convert(d.projection),
    }));
  }, [range, historyRows, fallbackData, convert]);

  const content = (
    <div className="p-5">
      <div className="flex items-center justify-end mb-4">
          <div className="flex items-center gap-0.5 bg-black/5 dark:bg-black/30 backdrop-blur-sm rounded-full p-1 ring-1 ring-black/10 dark:ring-white/10">
            {RANGE_LABELS.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                  range === r.id
                    ? "bg-black/10 dark:bg-white/15 text-foreground shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {histLoading ? (
          <div className="flex items-center justify-center h-[240px] text-xs text-muted-foreground">Loading...</div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[240px] text-xs text-muted-foreground">No data for this range</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }}
                axisLine={{ stroke: "hsl(220, 13%, 91%)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${symbol}${compactNumber(v)}`}
              />
              <Tooltip
                cursor={false}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid hsl(220, 13%, 91%)",
                  borderRadius: "8px",
                  color: "hsl(224, 71%, 4%)",
                  fontSize: "12px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
                }}
                formatter={(value: number) => [`${symbol}${compactNumber(value)}`, undefined]}
              />
              <Area
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="hsl(221, 83%, 53%)"
                strokeWidth={2.5}
                fill="url(#revGradient)"
                dot={{ r: chartData.length > 12 ? 0 : 4, fill: "hsl(221, 83%, 53%)", strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
              <Area
                type="monotone"
                dataKey="projection"
                name="Target"
                stroke="hsl(220, 9%, 70%)"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                fill="transparent"
                dot={{ r: chartData.length > 12 ? 0 : 3, fill: "hsl(220, 9%, 70%)", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
    </div>
  );

  if (embedded) return content;

  return (
    <Card className="lg:col-span-2 border-border/50">
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
}

