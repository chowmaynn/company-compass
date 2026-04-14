import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { generateWeekConfigs } from "@/data/scorecardData";
import { useScorecard } from "@/hooks/use-scorecard";
import { useCurrency, useSelectedMonth } from "@/components/AppLayout";
import { fetchRevenueHistory, fetchFinancialSummary, type ScorecardRow } from "@/lib/supabase-scorecard";
import { fetchSalesTracking } from "@/lib/supabase-sales";
import { useAuth } from "@/hooks/use-auth";
import { useFinanceOverview } from "@/hooks/use-finance-overview";
import { FunnelSankey } from "@/components/FunnelSankey";
import { FocusBoardSection } from "@/components/FocusBoardSection";
import { DateRangePicker, type DateRangeValue } from "@/components/DateRangePicker";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Speedometer Gauge ────────────────────────────────────────

function SpeedometerCard({
  label,
  value,
  target,
  symbol,
  formatValue,
  subtitle,
}: {
  label: string;
  value: number | null;
  target: number | null;
  symbol: string;
  formatValue?: (v: number) => string;
  subtitle?: string;
}) {
  const fmt = formatValue ?? ((v: number) => `${symbol}${compactNumber(v)}`);
  const pct = value !== null && target !== null && target > 0 ? Math.min((value / target) * 100, 120) : null;

  // SVG arc params — 240 degree sweep (from 150° to 390°)
  const cx = 130, cy = 130, r = 100;
  const startAngle = 150, endAngle = 390, sweep = endAngle - startAngle;

  const polarToCart = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const arcPath = (fromAngle: number, toAngle: number) => {
    const start = polarToCart(fromAngle);
    const end = polarToCart(toAngle);
    const largeArc = toAngle - fromAngle > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };

  const bgPath = arcPath(startAngle, endAngle);
  const fillAngle = pct !== null ? startAngle + (sweep * Math.min(pct, 100)) / 100 : startAngle;
  const fillPath = pct !== null && pct > 0 ? arcPath(startAngle, fillAngle) : "";

  const color = pct === null ? "stroke-muted-foreground"
    : pct >= 80 ? "stroke-emerald-500"
    : pct >= 50 ? "stroke-amber-400"
    : "stroke-red-400";

  return (
    <Card className="overflow-hidden p-5 flex flex-col items-center">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {subtitle && (
        <span className="text-[10px] text-muted-foreground mb-1">{subtitle}</span>
      )}
      <div className="relative w-[260px] h-[190px]">
        <svg viewBox="0 0 260 210" className="w-full h-full">
          {/* Background track */}
          <path d={bgPath} fill="none" strokeWidth={12} strokeLinecap="round"
            className="stroke-muted/50" />
          {/* Fill arc */}
          {fillPath && (
            <path d={fillPath} fill="none" strokeWidth={12} strokeLinecap="round"
              className={color} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
          )}
          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = startAngle + (sweep * tick) / 100;
            const outer = polarToCart(angle);
            const inner = { x: cx + (r - 10) * Math.cos((angle * Math.PI) / 180), y: cy + (r - 10) * Math.sin((angle * Math.PI) / 180) };
            return (
              <line key={tick} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                strokeWidth={1.5} className="stroke-muted-foreground/30" />
            );
          })}
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
          <span className="text-xl font-bold tracking-tight text-foreground">
            {value !== null ? fmt(value) : "—"}
          </span>
          {target !== null && (
            <span className="text-[10px] text-muted-foreground">
              Target: {fmt(target)}
            </span>
          )}
          {pct !== null && (
            <span className={`text-xs font-mono font-semibold mt-0.5 ${
              pct >= 80 ? "text-emerald-500" : pct >= 50 ? "text-amber-400" : "text-red-400"
            }`}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

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

/** Given a date range, return the list of YYYY-MM month strings it spans.
 *  If endDate is the 1st of a month, treat it as the previous month
 *  (handles NZ timezone bleed where Mar 31 23:59 local → Apr 1 NZT). */
function getMonthsInRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate) return [];
  let effectiveEnd = endDate;
  if (endDate.endsWith("-01")) {
    const d = new Date(endDate + "T00:00:00");
    d.setDate(d.getDate() - 1);
    effectiveEnd = d.toISOString().slice(0, 10);
  }
  const months: string[] = [];
  const [sy, sm] = startDate.split("-").map(Number);
  const [ey, em] = effectiveEnd.split("-").map(Number);
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}


// ── Component ────────────────────────────────────────────────

export default function Dashboard() {
  const { selectedMonth, setSelectedMonth } = useSelectedMonth();
  const { convert, symbol } = useCurrency();
  const [range, setRange] = useState<DateRangeValue>({ start: "", end: "", startDate: "", endDate: "" });

  // Derive the scorecard month(s) from the date range
  const rangeMonths = useMemo(() => getMonthsInRange(range.startDate, range.endDate), [range.startDate, range.endDate]);

  // The scorecard month — use the start of the picked range (avoids timezone bleed at end)
  const activeMonth = useMemo(() => {
    if (range.startDate) return range.startDate.slice(0, 7);
    return selectedMonth;
  }, [range.startDate, selectedMonth]);

  // Keep the global context in sync for other pages (sidebar, scorecard page)
  useEffect(() => {
    if (activeMonth !== selectedMonth) setSelectedMonth(activeMonth);
  }, [activeMonth]);

  const { metrics: scorecardData, loading } = useScorecard(activeMonth);

  // BambooHR headcount
  const [headcount, setHeadcount] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/bamboohr/employees/directory")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.employees) setHeadcount(data.employees.length);
      })
      .catch(() => {});
  }, []);

  // Deals closed for active month (from sales_tracking)
  const [monthlyCloses, setMonthlyCloses] = useState<number | null>(null);
  useEffect(() => {
    if (!activeMonth) return;
    let cancelled = false;
    fetchSalesTracking(activeMonth).then((rows) => {
      if (!cancelled) {
        const total = rows.reduce((sum, r) => sum + (r.closes ?? 0), 0);
        setMonthlyCloses(total);
      }
    });
    return () => { cancelled = true; };
  }, [activeMonth]);

  // Finance data from Supabase (for gauges)
  const financeOverview = useFinanceOverview();
  // Match finance data to the selected month, fall back to latest
  const selectedFinance = useMemo(() => {
    if (financeOverview.data.length === 0) return null;
    const match = financeOverview.data.find((d) => d.month === activeMonth);
    if (match) return match;
    // Fall back to latest
    return financeOverview.data[0];
  }, [financeOverview.data, activeMonth]);

  // Multi-month financial summary (Revenue + Cash Collected summed across range)
  const [financialSummary, setFinancialSummary] = useState<ScorecardRow[]>([]);
  useEffect(() => {
    if (rangeMonths.length <= 1) { setFinancialSummary([]); return; }
    let cancelled = false;
    fetchFinancialSummary(rangeMonths).then((rows) => {
      if (!cancelled) setFinancialSummary(rows);
    });
    return () => { cancelled = true; };
  }, [rangeMonths]);

  const formatCurrency = (val: number | string | undefined) => {
    if (!val || val === "—") return "—";
    const n = parseNum(String(val));
    return n !== null ? `${symbol}${compactNumber(convert(n))}` : String(val);
  };

  // For multi-month ranges, sum from weekly actuals + catchup (more reliable than monthly_actual which can be stale)
  const multiMonthFinancials = useMemo(() => {
    if (rangeMonths.length <= 1 || financialSummary.length === 0) return null;
    const sumMetric = (metricName: string) => {
      const rows = financialSummary.filter((r) => r.metric === metricName);
      let actualSum = 0, targetSum = 0, hasActual = false;
      for (const row of rows) {
        // Sum from weekly actuals + catchup to avoid stale monthly_actual
        const weekVals = [row.catchup_actual, row.w1_actual, row.w2_actual, row.w3_actual, row.w4_actual];
        for (const v of weekVals) {
          const n = parseNum(v);
          if (n !== null) { actualSum += n; hasActual = true; }
        }
        const t = parseNum(row.monthly_target);
        if (t !== null) targetSum += t;
      }
      return { actual: hasActual ? actualSum : null, target: targetSum || null };
    };
    return { revenue: sumMetric("Revenue"), cash: sumMetric("Cash Collected") };
  }, [rangeMonths, financialSummary]);

  const revenue = scorecardData.find((m) => m.name === "Revenue");
  const cash = scorecardData.find((m) => m.name === "Cash Collected");

  // Use multi-month sums when available, otherwise single-month scorecard
  const revActual = multiMonthFinancials?.revenue.actual ?? parseNum(revenue?.monthlyActual ?? "—");
  const revTarget = multiMonthFinancials?.revenue.target ?? parseNum(revenue?.monthlyTarget ?? "—");
  const cashActual = multiMonthFinancials?.cash.actual ?? parseNum(cash?.monthlyActual ?? "—");
  const cashTarget = multiMonthFinancials?.cash.target ?? parseNum(cash?.monthlyTarget ?? "—");

  const monthConfigs = useMemo(() => generateWeekConfigs(selectedMonth), [selectedMonth]);
  const revenueWeekly = useMemo(() =>
    revenue?.weeks.map((w, i) => ({
      week: monthConfigs[i]?.label ?? `W${i + 1}`,
      actual: parseNum(w.actual) ?? 0,
      projection: parseNum(w.projection) ?? 0,
    })) ?? [],
  [revenue, monthConfigs]);

  const revPct = revActual !== null && revTarget !== null && revTarget !== 0 ? Math.round((revActual / revTarget) * 100) : null;
  const cashPct = cashActual !== null && cashTarget !== null && cashTarget !== 0 ? Math.round((cashActual / cashTarget) * 100) : null;

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* ── Header row: Welcome + DateRangePicker ─────────── */}
      <div className="flex items-center justify-between">
        <WelcomeHeader />
        <div className="flex justify-end">
          <DateRangePicker defaultPreset="MTD" onChange={setRange} />
        </div>
      </div>

      {/* ── Financial Gauges ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SpeedometerCard
          label="Revenue"
          value={selectedFinance?.revenue != null ? convert(selectedFinance.revenue) : null}
          target={selectedFinance?.revenue_target != null ? convert(selectedFinance.revenue_target) : null}
          symbol={symbol}
        />
        <SpeedometerCard
          label="Revenue / Employee"
          value={selectedFinance?.revenue_per_employee != null ? convert(selectedFinance.revenue_per_employee) : null}
          target={selectedFinance?.revenue_per_employee_target != null ? convert(selectedFinance.revenue_per_employee_target) : null}
          symbol={symbol}
          subtitle={`${selectedFinance?.headcount ?? headcount ?? "—"} employees`}
        />
        <SpeedometerCard
          label="Deals Closed"
          value={monthlyCloses}
          target={100}
          symbol=""
          formatValue={(v) => String(v)}
          subtitle={activeMonth}
        />
      </div>

      {/* ── Focus Board ─────────────────────────────────────── */}
      <FocusBoardSection />

      {/* ── Conversion Funnel ─────────────────────────────── */}
      <FunnelSankey metrics={scorecardData} formatCurrency={formatCurrency} />

    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function WelcomeHeader() {
  const { user } = useAuth();
  const name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0];

  return (
    <h1 className="text-2xl font-bold text-foreground">
      Welcome{name ? `, ${name}` : ""}
    </h1>
  );
}

// ── Revenue Trend Chart ──────────────────────────────────────

function parseNumSafe(val: string): number | null {
  if (!val || val === "—") return null;
  const cleaned = val.replace(/[$,]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function flattenRevenueForRange(
  rows: ScorecardRow[],
  months: string[],
): { label: string; actual: number; projection: number }[] {
  const result: { label: string; actual: number; projection: number }[] = [];
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month));

  if (months.length === 1) {
    // Single month → show weekly breakdown
    for (const row of sorted) {
      const weeks = [
        { actual: row.w1_actual, target: row.w1_target, label: "W1" },
        { actual: row.w2_actual, target: row.w2_target, label: "W2" },
        { actual: row.w3_actual, target: row.w3_target, label: "W3" },
        { actual: row.w4_actual, target: row.w4_target, label: "W4" },
      ];
      for (const w of weeks) {
        const a = parseNumSafe(w.actual);
        if (a !== null) result.push({ label: w.label, actual: a, projection: parseNumSafe(w.target) ?? 0 });
      }
    }
  } else {
    // Multi-month → show monthly totals
    for (const row of sorted) {
      const [yr, mo] = row.month.split("-").map(Number);
      const monthLabel = new Date(yr, mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const total = parseNumSafe(row.monthly_actual);
      const target = parseNumSafe(row.monthly_target);
      if (total !== null) {
        result.push({ label: monthLabel, actual: total, projection: target ?? 0 });
      }
    }
  }

  return result;
}

function RevenueTrendChart({
  convert,
  symbol,
  fallbackData,
  months,
  selectedMonth,
}: {
  convert: (n: number) => number;
  symbol: string;
  fallbackData: { week: string; actual: number; projection: number }[];
  months: string[];
  selectedMonth: string;
}) {
  const [historyRows, setHistoryRows] = useState<ScorecardRow[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  // Determine which months to actually fetch — use selectedMonth as fallback
  const fetchMonths = useMemo(() => {
    if (months.length > 0) return months;
    return [selectedMonth];
  }, [months, selectedMonth]);

  useEffect(() => {
    if (fetchMonths.length === 0) return;
    let cancelled = false;
    setHistLoading(true);
    fetchRevenueHistory(fetchMonths).then((rows) => {
      if (!cancelled) {
        setHistoryRows(rows);
        setHistLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [fetchMonths]);

  const chartData = useMemo(() => {
    if (historyRows.length > 0) {
      return flattenRevenueForRange(historyRows, fetchMonths).map((d) => ({
        ...d,
        actual: convert(d.actual),
        projection: convert(d.projection),
      }));
    }
    // No history rows — use fallback from current scorecard
    if (!histLoading && fallbackData.length > 0) {
      return fallbackData.map((d) => ({
        label: d.week,
        actual: convert(d.actual),
        projection: convert(d.projection),
      }));
    }
    return [];
  }, [fetchMonths, historyRows, histLoading, fallbackData, convert]);

  return (
    <div className="p-5">
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
}
