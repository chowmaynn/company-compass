import { useState, useMemo, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { generateWeekConfigs } from "@/data/scorecardData";
import { useScorecard } from "@/hooks/use-scorecard";
import { useCurrency, useSelectedMonth } from "@/components/AppLayout";
import { fetchRevenueHistory, fetchFinancialSummary, type ScorecardRow } from "@/lib/supabase-scorecard";
import { fetchSalesTracking, fetchSalesTrackingRange } from "@/lib/supabase-sales";
import { useSupabaseMetrics } from "@/hooks/use-supabase-metrics";
import { toNZDate } from "@/lib/dates";
import { fetchQuarterlySettings, upsertQuarterlySettings, fetchAllQuarters, type InitiativeStatus } from "@/lib/supabase-focus";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useFinanceOverview } from "@/hooks/use-finance-overview";
import { useKitMarketing } from "@/hooks/use-kit-marketing";
import { useSkoolJoinsByDate, sumJoinsInRange } from "@/hooks/use-skool-joins";
import { fetchVideoCountInRange } from "@/hooks/use-channel-videos";
import { useWhosOut } from "@/hooks/use-whos-out";
import { fetchPageSessions } from "@/lib/google-analytics";
import { fetchWebinarJoins } from "@/lib/kit";
import { getYTClickData } from "@/lib/bitly";
import { FunnelSankey } from "@/components/FunnelSankey";
import { Checkbox } from "@/components/ui/checkbox";
import { useFocusBoard, getCurrentWeekStart, getCurrentQuarter } from "@/hooks/use-focus-board";
import { Target, RotateCcw, ChevronDown, ChevronLeft, ChevronRight, CirclePlus, Trash2, Plus, Star, Pencil, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MicroExpander } from "@/components/ui/micro-expander";
import { DividerLine } from "@/components/ui/divider-line";
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

  const color = pct === null ? "stroke-foreground/60"
    : pct >= 80 ? "stroke-emerald-400"
    : pct >= 50 ? "stroke-amber-300"
    : "stroke-red-400";

  return (
    <div className="px-5 py-0 flex flex-col items-center">
      <span className="text-sm font-semibold text-foreground/90">{label}</span>
      {subtitle && (
        <span className="text-[10px] text-foreground/60 mb-1">{subtitle}</span>
      )}
      <div className="relative w-full max-w-[220px] aspect-[260/190]">
        <svg viewBox="0 0 260 210" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Background track — brighter for contrast against gradient bg */}
          <path d={bgPath} fill="none" strokeWidth={12} strokeLinecap="round"
            className="stroke-foreground/15" />
          {/* Fill arc */}
          {fillPath && (
            <path d={fillPath} fill="none" strokeWidth={12} strokeLinecap="round"
              className={color} style={{ transition: "stroke-dashoffset 0.6s ease" }} />
          )}
          {/* Tick marks — brighter */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = startAngle + (sweep * tick) / 100;
            const outer = polarToCart(angle);
            const inner = { x: cx + (r - 10) * Math.cos((angle * Math.PI) / 180), y: cy + (r - 10) * Math.sin((angle * Math.PI) / 180) };
            return (
              <line key={tick} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
                strokeWidth={1.5} className="stroke-foreground/40" />
            );
          })}
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {value !== null ? fmt(value) : "—"}
          </span>
          {target !== null && (
            <span className="text-[10px] text-foreground/60">
              Target: {fmt(target)}
            </span>
          )}
          {pct !== null && (
            <span className={`text-xs font-mono font-semibold mt-0.5 ${
              pct >= 80 ? "text-emerald-600 dark:text-emerald-400" : pct >= 50 ? "text-amber-600 dark:text-amber-300" : "text-red-600 dark:text-red-400"
            }`}>
              {Math.round(pct)}%
            </span>
          )}
        </div>
      </div>
    </div>
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

  // Quarterly daily targets (for today/yesterday gauges)
  const [dailyTargets, setDailyTargets] = useState<{
    bookings: number | null;
    closeRate: number | null;
    cash: number | null;
  }>({ bookings: null, closeRate: null, cash: null });
  useEffect(() => {
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    const quarter = `${now.getFullYear()}-Q${q}`;
    let cancelled = false;
    fetchQuarterlySettings(quarter).then((s) => {
      if (cancelled || !s) return;
      setDailyTargets({
        bookings: s.daily_bookings_target,
        closeRate: s.daily_close_rate_target,
        cash: s.daily_cash_target,
      });
    });
    return () => { cancelled = true; };
  }, []);

  const [filterInitId, setFilterInitId] = useState<string | null>(null);

  // Number of days in the picked range (for scaling per-day targets)
  const rangeDays = useMemo(() => {
    if (!range.startDate || !range.endDate) return 1;
    return Math.max(1, Math.round(
      (Date.parse(range.endDate + "T00:00:00Z") - Date.parse(range.startDate + "T00:00:00Z")) / 86400000 + 1
    ));
  }, [range.startDate, range.endDate]);

  // Friendly label for the gauge subtitle
  const rangeSubtitle = useMemo(() => {
    if (!range.startDate || !range.endDate) return "";
    const today = toNZDate(new Date());
    const yesterday = (() => {
      const ms = Date.parse(today + "T00:00:00Z") - 86400000;
      return new Date(ms).toISOString().slice(0, 10);
    })();
    if (range.startDate === range.endDate) {
      if (range.startDate === today) return "Today";
      if (range.startDate === yesterday) return "Yesterday";
      return new Date(range.startDate + "T12:00:00Z").toLocaleDateString("en-NZ", { month: "short", day: "numeric" });
    }
    const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-NZ", { month: "short", day: "numeric" });
    return `${fmt(range.startDate)} – ${fmt(range.endDate)}`;
  }, [range.startDate, range.endDate]);

  // Bookings (qualified) for the selected range
  const dailyBookings = useSupabaseMetrics(
    range.start || (toNZDate(new Date()) + "T00:00:00Z"),
    range.end   || (toNZDate(new Date()) + "T23:59:59Z"),
  );

  // ── Cockpit funnel data sources ───────────────────────────────────────
  // Email broadcasts → Kit
  const kit = useKitMarketing(range.startDate, range.endDate);
  const emailBroadcastsValue = useMemo(
    () => (kit.loading || !range.startDate ? null : kit.broadcasts.length),
    [kit.broadcasts.length, kit.loading, range.startDate]
  );

  // Skool joins → Supabase (same shared data the marketing page uses)
  const skoolMonth = useMemo(() => {
    const d = range.startDate ? new Date(range.startDate + "T12:00:00") : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [range.startDate]);
  const skoolJoinsDaily = useSkoolJoinsByDate(skoolMonth.year, skoolMonth.month);
  const skoolJoinsValue = useMemo(() => {
    if (skoolJoinsDaily.loading || !range.startDate || !range.endDate) return null;
    return sumJoinsInRange(skoolJoinsDaily.joinsByDate, range.startDate, range.endDate);
  }, [skoolJoinsDaily.joinsByDate, skoolJoinsDaily.loading, range.startDate, range.endDate]);

  // Website views → GA4 (page sessions over the range)
  const websiteViewsQuery = useQuery({
    queryKey: ["ga4-page-sessions", range.startDate, range.endDate],
    queryFn: () => fetchPageSessions(range.startDate, range.endDate),
    enabled: !!range.startDate && !!range.endDate,
  });
  const websiteViewsValue = typeof websiteViewsQuery.data === "number" ? websiteViewsQuery.data : null;

  // Bookings attribution: split the qualified bookings by source so we can draw
  // connection lines from each Nurturing card to the Bookings gauge.
  const nurturingBookings = useMemo(() => {
    const breakdown = dailyBookings.salesEventBreakdown ?? [];
    let website = 0, skool = 0, webinar = 0;
    for (const e of breakdown) {
      const n = e.name.toLowerCase();
      if (n.startsWith("skool")) skool += e.qualified;
      else if (n.startsWith("website")) website += e.qualified;
      else if (n.includes("masterclass") || n.includes("webinar")) webinar += e.qualified;
    }
    return { website, skool, webinar };
  }, [dailyBookings.salesEventBreakdown]);

  // YouTube videos → liam_videos table in Supabase (same source the Content page uses)
  const youtubeVideosQuery = useQuery({
    queryKey: ["liam-videos-count", range.startDate, range.endDate],
    queryFn: () => fetchVideoCountInRange(range.startDate, range.endDate),
    enabled: !!range.startDate && !!range.endDate,
  });
  const youtubeVideosValue = typeof youtubeVideosQuery.data === "number" ? youtubeVideosQuery.data : null;

  // YouTube → Skool / Website attribution (Bitly): a single combined query that
  // returns BOTH the aggregate totals (cumulative clicks across all videos) AND
  // the per-video subset (clicks specifically from videos published in the range).
  // Replaces two separate queries — ~4–5× faster end-to-end.
  const ytDataQuery = useQuery({
    queryKey: ["bitly-yt-data", range.startDate, range.endDate],
    queryFn: () => getYTClickData(range.startDate, range.endDate),
    enabled: !!range.startDate && !!range.endDate,
    staleTime: 30 * 60 * 1000, // results are fresh for 30 min
    gcTime: 60 * 60 * 1000,    // keep in memory for 1 hour so re-picking presets is instant
  });
  const ytToSkoolClicks = ytDataQuery.data?.ytToSkool ?? null;
  const ytToWebsiteClicks = ytDataQuery.data?.ytToWebsite ?? null;
  const ytFromRangeVideosToSkool = ytDataQuery.data?.ytToSkoolFromNew ?? null;
  const ytFromRangeVideosToWebsite = ytDataQuery.data?.ytToWebsiteFromNew ?? null;
  const skoolToWebsiteClicks = ytDataQuery.data?.skoolToWebsite ?? null;

  // Webinar joins → Kit (count of subscribers tagged with any "webinar" tag in range)
  const webinarJoinsQuery = useQuery({
    queryKey: ["kit-webinar-joins", range.startDate, range.endDate],
    queryFn: () => fetchWebinarJoins(range.startDate, range.endDate),
    enabled: !!range.startDate && !!range.endDate,
    staleTime: 5 * 60 * 1000,
  });
  const webinarJoinsValue = typeof webinarJoinsQuery.data === "number" ? webinarJoinsQuery.data : null;

  // Sales tracking — sum closes, calls_booked, calls_taken, cc across all reps for the range
  const [dailyCloseRate, setDailyCloseRate] = useState<number | null>(null);
  const [dailyShowRate, setDailyShowRate] = useState<number | null>(null);
  const [dailyCashCollected, setDailyCashCollected] = useState<number | null>(null);
  useEffect(() => {
    if (!range.startDate || !range.endDate) return;
    let cancelled = false;
    fetchSalesTrackingRange(range.startDate, range.endDate).then((rows) => {
      if (cancelled) return;
      const closes = rows.reduce((s, r) => s + (r.closes ?? 0), 0);
      const booked = rows.reduce((s, r) => s + (r.calls_booked ?? 0), 0);
      const taken = rows.reduce((s, r) => s + (r.calls_taken ?? 0), 0);
      const cc = rows.reduce((s, r) => s + (r.cc ?? 0), 0);
      setDailyCloseRate(taken > 0 ? Math.round((closes / taken) * 100) : null);
      setDailyShowRate(booked > 0 ? Math.round((taken / booked) * 100) : null);
      setDailyCashCollected(cc);
    });
    return () => { cancelled = true; };
  }, [range.startDate, range.endDate]);

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
    <div className="px-20 py-6 space-y-6 max-w-[1440px] mx-auto">
      {/* ── Top Section: Personal Focus (left) + Team's Focus (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-3">
          <WelcomeHeader />
          <MyFocusItems filterInitId={filterInitId} />
        </div>
        <div className="space-y-3">
          <RallyingCryBanner />
          <NorthStarsCard />
          <QuarterlyInitiativesCard activeId={filterInitId} onToggle={(id) => setFilterInitId((curr) => curr === id ? null : id)} />
          <TeamFocusCard filterInitId={filterInitId} />
          <TeamClocks />
        </div>
      </div>

      <DividerLine />

      {/* ── Conversion Cockpit Heading ─────────────────────── */}
      <div className="flex items-center gap-2.5 justify-center">
        <svg className="h-[18px] w-[18px] text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
        <h2 className="text-[18px] font-semibold text-foreground uppercase tracking-wider">Conversion Cockpit</h2>
      </div>

      {/* ── Shared Time Selector — drives the entire cockpit funnel below ─── */}
      <div className="flex justify-center">
        <DateRangePicker defaultPreset="today" onChange={setRange} />
      </div>

      {/* ── Cockpit Funnel: distribution → nurturing → gauges (bookings, show rate, close rate, cash) ─ */}
      <FunnelSankey
        metrics={scorecardData}
        formatCurrency={formatCurrency}
        rangeDays={rangeDays}
        youtubeVideosValue={youtubeVideosValue}
        emailBroadcastsValue={emailBroadcastsValue}
        skoolJoinsValue={skoolJoinsValue}
        websiteViewsValue={websiteViewsValue}
        webinarJoinsValue={webinarJoinsValue}
        skoolBookings={nurturingBookings.skool}
        websiteBookings={nurturingBookings.website}
        webinarBookings={nurturingBookings.webinar}
        ytToSkoolClicks={ytToSkoolClicks}
        ytToWebsiteClicks={ytToWebsiteClicks}
        ytFromRangeVideosToSkool={ytFromRangeVideosToSkool}
        ytFromRangeVideosToWebsite={ytFromRangeVideosToWebsite}
        skoolToWebsiteClicks={skoolToWebsiteClicks}
        ytClicksLoading={ytDataQuery.isLoading}
        ytPerVideoLoading={ytDataQuery.isLoading}
        bookingsAttributionLoading={dailyBookings.isLoading}
        youtubeVideosLoading={youtubeVideosQuery.isLoading}
        emailBroadcastsLoading={kit.loading}
        skoolJoinsLoading={skoolJoinsDaily.loading}
        websiteViewsLoading={websiteViewsQuery.isLoading}
        webinarJoinsLoading={webinarJoinsQuery.isLoading}
        bookingsGauge={
          <SpeedometerCard
            label="Qualified Bookings"
            value={dailyBookings.totalQualified ?? null}
            target={dailyTargets.bookings != null ? dailyTargets.bookings * rangeDays : null}
            symbol=""
            formatValue={(v) => String(v)}
          />
        }
        showRateGauge={
          <SpeedometerCard
            label="Show Rate"
            value={dailyShowRate}
            target={parseNum(scorecardData.find((m) => m.name === "Closing Call Show Rate")?.monthlyTarget ?? "—")}
            symbol=""
            formatValue={(v) => `${v}%`}
          />
        }
        closeRateGauge={
          <SpeedometerCard
            label="Close Rate"
            value={dailyCloseRate}
            target={dailyTargets.closeRate}
            symbol=""
            formatValue={(v) => `${v}%`}
          />
        }
        cashGauge={
          <SpeedometerCard
            label="Cash Collected"
            value={dailyCashCollected != null ? convert(dailyCashCollected) : null}
            target={dailyTargets.cash != null ? convert(dailyTargets.cash * rangeDays) : null}
            symbol={symbol}
          />
        }
      />

    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function WelcomeHeader() {
  const { user } = useAuth();
  const raw = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const name = raw.charAt(0).toUpperCase() + raw.slice(1);

  return (
    <h1 className="text-2xl font-bold text-foreground">
      Welcome{name ? `, ${name}` : ""}
    </h1>
  );
}

// ── My Focus Items (for current user, current week) ──────────

function InitiativeSelect({
  value,
  onChange,
  initiatives,
}: {
  value: string;
  onChange: (v: string) => void;
  initiatives: { id: string; title: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = value ? initiatives.find((i) => i.id === value) : null;
  const label = selected?.title ?? "No initiative";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors w-[140px] text-left truncate"
      >
        {label}
      </button>
      {open && (
        <div className="absolute z-20 mt-2 right-0 bg-popover/95 backdrop-blur-xl border border-border/60 rounded-lg shadow-lg py-1 min-w-[200px] max-h-[240px] overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className={`w-full text-left text-xs px-3 py-1.5 hover:bg-muted/50 transition-colors ${!value ? "text-foreground font-medium" : "text-muted-foreground"}`}
          >
            No initiative
          </button>
          {initiatives.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => { onChange(i.id); setOpen(false); }}
              className={`w-full text-left text-xs px-3 py-1.5 hover:bg-muted/50 transition-colors truncate ${value === i.id ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              {i.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemInitiativeChip({
  currentId,
  currentTitle,
  initiatives,
  onChange,
}: {
  currentId: string | null;
  currentTitle: string | null | undefined;
  initiatives: { id: string; title: string }[];
  onChange: (newId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Target className="h-3 w-3" />
        {currentTitle ?? "Add initiative"}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 left-0 bg-popover/95 backdrop-blur-xl border border-border/60 rounded-lg shadow-lg py-1 min-w-[200px] max-h-[240px] overflow-y-auto">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full text-left text-xs px-3 py-1.5 hover:bg-muted/50 transition-colors ${!currentId ? "text-foreground font-medium" : "text-muted-foreground"}`}
          >
            No initiative
          </button>
          {initiatives.map((i) => (
            <button
              key={i.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(i.id); setOpen(false); }}
              className={`w-full text-left text-xs px-3 py-1.5 hover:bg-muted/50 transition-colors truncate ${currentId === i.id ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              {i.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuarterPicker({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Fetch all quarters that have data in supabase
  const { data: savedQuarters = [] } = useQuery({
    queryKey: ["all-quarters"],
    queryFn: fetchAllQuarters,
    staleTime: 10 * 60 * 1000,
  });

  // Union current year's quarters + any saved quarters + the currently selected quarter
  const options = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const set = new Set<string>();
    for (let qi = 1; qi <= 4; qi++) set.add(`${thisYear}-Q${qi}`);
    for (const q of savedQuarters) set.add(q);
    set.add(value); // ensure currently selected is always visible
    // Sort descending (most recent first)
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [savedQuarters, value]);

  const [year, q] = value.split("-Q");
  const label = `Q${q} · ${year}`;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 left-1/2 -translate-x-1/2 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[120px] max-h-[240px] overflow-y-auto">
          {options.map((opt) => {
            const [oy, oq] = opt.split("-Q");
            const isSel = opt === value;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`block w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSel ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                Q{oq} · {oy}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RallyingCryBanner() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const { data: settings } = useQuery({
    queryKey: ["quarterly-settings", selectedQuarter],
    queryFn: () => fetchQuarterlySettings(selectedQuarter),
    staleTime: 10 * 60 * 1000,
  });

  const rallyingCry = settings?.rallying_cry ?? null;

  async function handleSave() {
    await upsertQuarterlySettings(selectedQuarter, draft);
    queryClient.invalidateQueries({ queryKey: ["quarterly-settings", selectedQuarter] });
    setEditing(false);
  }

  return (
    <div className="flex flex-col items-center space-y-2 text-center">
      {editing ? (
        <>
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What's the rallying cry this quarter?"
            className="w-full bg-transparent text-lg font-semibold text-foreground italic text-center placeholder:text-muted-foreground/60 placeholder:font-normal placeholder:not-italic border-b border-border/50 focus:border-border outline-none py-1 transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
          />
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleSave} className="text-xs font-medium text-foreground hover:text-primary transition-colors">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </>
      ) : rallyingCry ? (
        <button
          onClick={() => { if (isAdmin) { setDraft(rallyingCry); setEditing(true); } }}
          className={`text-lg font-semibold text-foreground italic ${isAdmin ? "hover:text-primary cursor-pointer" : "cursor-default"}`}
        >
          &ldquo;{rallyingCry}&rdquo;
        </button>
      ) : isAdmin ? (
        <button
          onClick={() => { setDraft(""); setEditing(true); }}
          className="text-sm text-muted-foreground hover:text-foreground italic"
        >
          + Set a rallying cry
        </button>
      ) : (
        <p className="text-sm text-muted-foreground italic">No rallying cry set</p>
      )}

      <QuarterPicker value={selectedQuarter} onChange={setSelectedQuarter} />
    </div>
  );
}

function NorthStarsCard() {
  const { isAdmin } = useAuth();
  const { northStars, addNorthStar, editNorthStar, removeNorthStar, loading } = useFocusBoard();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  if (loading) return null;

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await addNorthStar(newTitle.trim(), newDesc.trim() || null);
    setNewTitle("");
    setNewDesc("");
    setShowAdd(false);
    setOpen(true);
  }

  function startEdit(ns: typeof northStars[number]) {
    setEditingId(ns.id);
    setEditTitle(ns.title);
    setEditDesc(ns.description ?? "");
  }

  async function saveEdit() {
    if (!editingId || !editTitle.trim()) return;
    await editNorthStar(editingId, editTitle.trim(), editDesc.trim() || null);
    setEditingId(null);
  }

  return (
    <div className="space-y-3">
      {showAdd && (
        <div className="space-y-2 p-3 rounded-lg bg-amber-500/[0.04] ring-1 ring-amber-500/15">
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. 10,000 paying customers by end of 2026"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 border-b border-border/50 focus:border-amber-400/50 outline-none py-1.5 transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setShowAdd(false);
            }}
          />
          <input
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Why this matters (optional)"
            className="w-full bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/60 outline-none py-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setShowAdd(false);
            }}
          />
          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleAdd} disabled={!newTitle.trim()} className="text-xs font-medium text-amber-400 hover:text-amber-600 dark:text-amber-300 disabled:opacity-30 disabled:pointer-events-none transition-colors">Add</button>
            <button onClick={() => { setShowAdd(false); setNewTitle(""); setNewDesc(""); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
        className={[
          "w-full flex items-center justify-between gap-3 p-4 rounded-xl text-left transition-all cursor-pointer",
          "bg-gradient-to-b from-amber-500/[0.06] to-amber-500/[0.02]",
          "backdrop-blur-xl ring-1 ring-amber-500/20",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_2px_12px_-4px_rgba(0,0,0,0.2)]",
          "hover:ring-amber-500/40",
        ].join(" ")}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-500/15 text-amber-400 shrink-0">
            <Star className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              North Stars
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {northStars.length} {northStars.length === 1 ? "north star" : "north stars"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {isAdmin && !showAdd && (
            <div onClick={(e) => e.stopPropagation()}>
              <MicroExpander
                text="Add North Star"
                icon={<Plus className="h-3.5 w-3.5" />}
                variant="outline"
                className="hover:border-input"
                onClick={() => { setShowAdd(true); setOpen(true); }}
              />
            </div>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {open && (
        <div className="space-y-2">
          {northStars.length === 0 && !showAdd ? (
            <p className="text-xs text-muted-foreground italic">No north stars set yet.</p>
          ) : (
            northStars.map((ns) => {
              const isEditing = editingId === ns.id;
              return (
                <div
                  key={ns.id}
                  className="group/ns flex items-start gap-3 px-3 py-2.5 rounded-lg bg-amber-500/[0.04] ring-1 ring-amber-500/10"
                >
                  <Star className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <input
                          autoFocus
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full bg-transparent text-sm text-foreground border-b border-amber-400/40 outline-none py-0.5"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <input
                          type="text"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Description"
                          className="w-full bg-transparent text-xs text-muted-foreground outline-none py-0.5"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <div className="flex gap-3 pt-0.5">
                          <button onClick={saveEdit} className="text-[10px] font-medium text-amber-400 hover:text-amber-600 dark:text-amber-300">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-[10px] text-muted-foreground hover:text-foreground">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-foreground">{ns.title}</p>
                        {ns.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{ns.description}</p>
                        )}
                      </>
                    )}
                  </div>
                  {isAdmin && !isEditing && (
                    <div className="flex items-center gap-3 opacity-0 group-hover/ns:opacity-100 transition-opacity shrink-0 mt-0.5">
                      <button onClick={() => startEdit(ns)} className="text-muted-foreground hover:text-foreground" aria-label="Edit">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => removeNorthStar(ns.id)} className="text-muted-foreground hover:text-red-500" aria-label="Delete">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const DEPARTMENTS = ["Finance", "Content", "Marketing", "Sales", "Product"];

function displayName(email: string): string {
  const name = email.split("@")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Lightweight multi-select dropdown for stakeholders
function StakeholderSelect({
  selected, onChange, users
}: {
  selected: string[];
  onChange: (val: string[]) => void;
  users: { user_id: string; user_email: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (email: string) => {
    onChange(selected.includes(email) ? selected.filter(s => s !== email) : [...selected, email]);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-xs bg-transparent border-b border-border/30 focus:border-foreground/30 px-0 py-1 text-muted-foreground text-left truncate outline-none transition-colors"
      >
        {selected.length > 0 ? selected.map(s => displayName(s)).join(", ") : "Stakeholders"}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[160px] max-h-[200px] overflow-y-auto">
          {users.map((u) => (
            <label key={u.user_id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={selected.includes(u.user_email)}
                onChange={() => toggle(u.user_email)}
                className="rounded"
              />
              {displayName(u.user_email)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** Custom popover-based status selector that matches the ItemInitiativeChip glass-popover style. */
function StatusSelect({
  value,
  onChange,
}: {
  value: InitiativeStatus;
  onChange: (s: InitiativeStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const statusStyle = (s: string) =>
    s === "On-Track" ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
      : s === "Behind" ? "text-amber-600 dark:text-amber-300 bg-amber-500/10"
      : s === "Accomplished" ? "text-blue-600 dark:text-blue-400 bg-blue-500/10"
      : "text-red-400 bg-red-500/10";

  const options: InitiativeStatus[] = ["Not Started", "On-Track", "Behind", "Accomplished"];

  return (
    <div ref={ref} className="relative inline-block shrink-0">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`text-[10px] font-medium rounded-full px-2 py-0.5 cursor-pointer transition-colors ${statusStyle(value)}`}
      >
        {value}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 right-0 bg-popover/95 backdrop-blur-xl border border-border/60 rounded-lg shadow-lg py-1 min-w-[140px]">
          {options.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors flex items-center ${
                s === value ? "bg-muted/30" : ""
              }`}
            >
              <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${statusStyle(s)}`}>
                {s}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuarterlyInitiativesCard({ activeId, onToggle }: { activeId: string | null; onToggle: (id: string) => void }) {
  const { isAdmin } = useAuth();
  const { initiatives, foci, northStars, teamUsers, addInitiative, editInitiative, removeInitiative, loading } = useFocusBoard();
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [newTitle, setNewTitle] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newNorthStarId, setNewNorthStarId] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newStakeholders, setNewStakeholders] = useState<string[]>([]);

  // Edit form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editNorthStarId, setEditNorthStarId] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editStakeholders, setEditStakeholders] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState<"Not Started" | "On-Track" | "Behind" | "Accomplished">("Not Started");

  // Open the card when filter is active
  useEffect(() => {
    if (activeId) setOpen(true);
  }, [activeId]);

  const counts = useMemo(() => {
    const c = { offTrack: 0, behind: 0, onTrack: 0, accomplished: 0, notStarted: 0 };
    for (const i of initiatives) {
      if (i.status === "On-Track") c.onTrack++;
      else if (i.status === "Behind") c.behind++;
      else if (i.status === "Accomplished") c.accomplished++;
      else c.notStarted++;
    }
    return c;
  }, [initiatives]);

  // Progress: how many focus items are tied to each initiative and how many are complete
  const initiativeProgress = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    for (const i of initiatives) map.set(i.id, { total: 0, completed: 0 });
    for (const f of foci) {
      if (f.quarterly_initiative_id && map.has(f.quarterly_initiative_id)) {
        const p = map.get(f.quarterly_initiative_id)!;
        p.total++;
        if (f.completed) p.completed++;
      }
    }
    return map;
  }, [initiatives, foci]);

  // Sort by due date (nulls last) — same as focus board
  const sorted = useMemo(() => {
    return [...initiatives].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
  }, [initiatives]);

  if (loading) return null;

  const statusStyle = (s: string) =>
    s === "On-Track" ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
      : s === "Behind" ? "text-amber-600 dark:text-amber-300 bg-amber-500/10"
      : s === "Accomplished" ? "text-blue-600 dark:text-blue-400 bg-blue-500/10"
      : "text-red-400 bg-red-500/10";

  const statusDot = (s: string) =>
    s === "On-Track" ? "bg-emerald-400"
      : s === "Behind" ? "bg-amber-300"
      : s === "Accomplished" ? "bg-blue-400"
      : "bg-red-400";

  async function handleAdd() {
    if (!newTitle.trim() || !newDept) return;
    await addInitiative({
      title: newTitle.trim(),
      department: newDept === "company" ? null : newDept,
      northStarId: newNorthStarId || null,
      dueDate: newDueDate || null,
      owner: newOwner || null,
      stakeholders: newStakeholders.length > 0 ? newStakeholders.join(",") : null,
    });
    setNewTitle("");
    setNewDept("");
    setNewNorthStarId("");
    setNewDueDate("");
    setNewOwner("");
    setNewStakeholders([]);
    setShowAdd(false);
    setOpen(true);
  }

  function startEdit(i: typeof initiatives[number]) {
    setEditingId(i.id);
    setEditTitle(i.title);
    setEditDept(i.department ?? "company");
    setEditNorthStarId(i.north_star_id ?? "");
    setEditDueDate(i.due_date ?? "");
    setEditOwner(i.owner ?? "");
    setEditStakeholders(i.stakeholders ? i.stakeholders.split(",").map((s) => s.trim()) : []);
    setEditStatus(i.status);
  }

  async function saveEdit() {
    if (!editingId || !editTitle.trim()) return;
    await editInitiative(editingId, {
      title: editTitle.trim(),
      department: editDept === "company" ? null : editDept,
      northStarId: editNorthStarId || null,
      dueDate: editDueDate || null,
      owner: editOwner || null,
      stakeholders: editStakeholders.length > 0 ? editStakeholders.join(",") : null,
      status: editStatus,
    });
    setEditingId(null);
  }

  return (
    <div className="space-y-3">
      {showAdd && (
        <div className="space-y-2 p-3 rounded-lg bg-white/[0.03] ring-1 ring-white/10">
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Launch new pricing page this quarter"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 border-b border-border/50 focus:border-foreground/40 outline-none py-1.5 transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setShowAdd(false);
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              className="w-full bg-transparent text-xs text-muted-foreground outline-none py-1 border-b border-border/30 focus:border-foreground/30 transition-colors"
            >
              <option value="" disabled>Department *</option>
              <option value="company">Company</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full bg-transparent text-xs text-muted-foreground outline-none py-1 border-b border-border/30 focus:border-foreground/30 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              className="w-full bg-transparent text-xs text-muted-foreground outline-none py-1 border-b border-border/30 focus:border-foreground/30 transition-colors"
            >
              <option value="">Owner</option>
              {teamUsers.map((u) => (
                <option key={u.user_id} value={u.user_email}>{displayName(u.user_email)}</option>
              ))}
            </select>
            <StakeholderSelect
              selected={newStakeholders}
              onChange={setNewStakeholders}
              users={teamUsers}
            />
          </div>
          {northStars.length > 0 && (
            <select
              value={newNorthStarId}
              onChange={(e) => setNewNorthStarId(e.target.value)}
              className="w-full bg-transparent text-xs text-muted-foreground outline-none py-1 border-b border-border/30 focus:border-foreground/30 transition-colors"
            >
              <option value="">No North Star</option>
              {northStars.map((ns) => (
                <option key={ns.id} value={ns.id}>{ns.title}</option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleAdd} disabled={!newTitle.trim() || !newDept} className="text-xs font-medium text-foreground hover:text-foreground/80 disabled:opacity-30 disabled:pointer-events-none transition-colors">Add</button>
            <button onClick={() => { setShowAdd(false); setNewTitle(""); setNewDept(""); setNewNorthStarId(""); setNewDueDate(""); setNewOwner(""); setNewStakeholders([]); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
        className={[
          "w-full flex items-center justify-between gap-3 p-4 rounded-xl text-left transition-all cursor-pointer",
          "bg-gradient-to-b from-black/[0.04] to-black/[0.02] dark:from-white/[0.06] dark:to-white/[0.02]",
          "backdrop-blur-xl ring-1 ring-black/15 dark:ring-white/10",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_2px_12px_-4px_rgba(0,0,0,0.2)]",
          "hover:ring-white/20",
        ].join(" ")}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted text-muted-foreground shrink-0">
            <Target className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              Initiatives
            </p>
            <p className="text-[11px] text-muted-foreground flex items-center gap-2">
              {(() => {
                const segments: React.ReactNode[] = [];
                if (counts.offTrack > 0) segments.push(<span key="off" className="text-red-600 dark:text-red-400">{counts.offTrack} Off Track</span>);
                if (counts.behind > 0) segments.push(<span key="beh" className="text-amber-600 dark:text-amber-300">{counts.behind} Behind</span>);
                if (counts.onTrack > 0) segments.push(<span key="on" className="text-emerald-600 dark:text-emerald-400">{counts.onTrack} On Track</span>);
                if (counts.accomplished > 0) segments.push(<span key="acc" className="text-blue-600 dark:text-blue-400">{counts.accomplished} Done</span>);
                if (segments.length === 0) return <span>No initiatives yet</span>;
                return segments.flatMap((seg, idx) =>
                  idx === 0 ? [seg] : [<span key={`sep-${idx}`} className="text-muted-foreground/40">·</span>, seg]
                );
              })()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {isAdmin && !showAdd && (
            <div onClick={(e) => e.stopPropagation()}>
              <MicroExpander
                text="Add Initiative"
                icon={<Plus className="h-3.5 w-3.5" />}
                variant="outline"
                className="hover:border-input"
                onClick={() => { setShowAdd(true); setOpen(true); }}
              />
            </div>
          )}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {open && (
        <div className="space-y-2">
          {sorted.length === 0 && !showAdd ? (
            <p className="text-xs text-muted-foreground italic">No initiatives this quarter.</p>
          ) : (
            sorted.map((i) => {
              const isActive = activeId === i.id;
              const isEditing = editingId === i.id;
              const progress = initiativeProgress.get(i.id);
              const stakeholderList = i.stakeholders ? i.stakeholders.split(",").map((s) => s.trim()) : [];

              if (isEditing) {
                return (
                  <div
                    key={i.id}
                    className="space-y-2 p-3 rounded-lg bg-white/[0.03] ring-1 ring-white/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-transparent text-sm text-foreground border-b border-foreground/40 outline-none py-0.5"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={editDept}
                        onChange={(e) => setEditDept(e.target.value)}
                        className="w-full bg-transparent text-xs text-muted-foreground outline-none py-1 border-b border-border/30 focus:border-foreground/30 transition-colors"
                      >
                        <option value="company">Company</option>
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="w-full bg-transparent text-xs text-muted-foreground outline-none py-1 border-b border-border/30 focus:border-foreground/30 transition-colors"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={editOwner}
                        onChange={(e) => setEditOwner(e.target.value)}
                        className="w-full bg-transparent text-xs text-muted-foreground outline-none py-1 border-b border-border/30 focus:border-foreground/30 transition-colors"
                      >
                        <option value="">No owner</option>
                        {teamUsers.map((u) => (
                          <option key={u.user_id} value={u.user_email}>{displayName(u.user_email)}</option>
                        ))}
                      </select>
                      <StakeholderSelect
                        selected={editStakeholders}
                        onChange={setEditStakeholders}
                        users={teamUsers}
                      />
                    </div>
                    {northStars.length > 0 && (
                      <select
                        value={editNorthStarId}
                        onChange={(e) => setEditNorthStarId(e.target.value)}
                        className="w-full bg-transparent text-xs text-muted-foreground outline-none py-1 border-b border-border/30 focus:border-foreground/30 transition-colors"
                      >
                        <option value="">No North Star</option>
                        {northStars.map((ns) => (
                          <option key={ns.id} value={ns.id}>{ns.title}</option>
                        ))}
                      </select>
                    )}
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as typeof editStatus)}
                      className="w-full bg-transparent text-xs text-muted-foreground outline-none py-1 border-b border-border/30 focus:border-foreground/30 transition-colors"
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="On-Track">On-Track</option>
                      <option value="Behind">Behind</option>
                      <option value="Accomplished">Accomplished</option>
                    </select>
                    <div className="flex gap-3 pt-0.5">
                      <button onClick={saveEdit} className="text-[10px] font-medium text-foreground hover:text-foreground/80">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-[10px] text-muted-foreground hover:text-foreground">Cancel</button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={i.id}
                  className={`group/init w-full rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary/15 ring-1 ring-primary/40"
                      : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-3 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onToggle(i.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${statusDot(i.status)}`} />
                      <span className={`text-sm flex-1 truncate ${isActive ? "text-foreground font-medium" : "text-foreground"}`}>{i.title}</span>
                      {progress && progress.total > 0 && (
                        <span className="text-[10px] text-muted-foreground/70 shrink-0">{progress.completed}/{progress.total}</span>
                      )}
                      {i.due_date && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(i.due_date + "T12:00:00").toLocaleDateString("en-NZ", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </button>
                    {isAdmin ? (
                      <StatusSelect
                        value={i.status}
                        onChange={(s) => editInitiative(i.id, { status: s })}
                      />
                    ) : (
                      <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0 ${statusStyle(i.status)}`}>
                        {i.status}
                      </span>
                    )}
                    {isAdmin && (
                      <div className="flex items-center gap-2 opacity-0 group-hover/init:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); startEdit(i); }}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeInitiative(i.id); }}
                          className="text-muted-foreground hover:text-red-500"
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Metadata row */}
                  {(i.owner || stakeholderList.length > 0 || i.department) && (
                    <div className="flex items-center gap-4 px-3 pb-2 ml-[14px] text-[10px] text-muted-foreground">
                      {i.owner && <span><span className="text-muted-foreground/50">Owner</span> {displayName(i.owner)}</span>}
                      {stakeholderList.length > 0 && <span className="truncate"><span className="text-muted-foreground/50">Stakeholders</span> {stakeholderList.map(displayName).join(", ")}</span>}
                      <span><span className="text-muted-foreground/50">Dept</span> {i.department ?? "Company"}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function shiftWeek(weekStart: string, delta: number): string {
  const d = new Date(weekStart + "T12:00:00");
  d.setDate(d.getDate() + delta * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Local-time clocks for each teammate. Updates every minute.
const TEAM_LOCATIONS = [
  { name: "Adam",     city: "Orlando",  tz: "America/New_York" },
  { name: "Nicholay", city: "Bali",     tz: "Asia/Makassar" },
  { name: "Liam",     city: "Bali",     tz: "Asia/Makassar" },
  { name: "Casey",    city: "Auckland", tz: "Pacific/Auckland" },
  { name: "Josh",     city: "Auckland", tz: "Pacific/Auckland" },
  { name: "Lana",     city: "Auckland", tz: "Pacific/Auckland" },
  { name: "Matt",     city: "Auckland", tz: "Pacific/Auckland" },
];

function TeamClocks() {
  const [now, setNow] = useState(() => new Date());
  const { outFirstNames, outByName } = useWhosOut(); // BambooHR — who's on time off today

  function fmtRange(start: string, end: string): string {
    const s = new Date(start + "T12:00:00Z");
    const e = new Date(end + "T12:00:00Z");
    const sMonth = s.toLocaleDateString("en-US", { month: "short" });
    const eMonth = e.toLocaleDateString("en-US", { month: "short" });
    if (start === end) return `Off: ${sMonth} ${s.getUTCDate()}`;
    if (sMonth === eMonth) return `Off: ${sMonth} ${s.getUTCDate()}–${e.getUTCDate()}`;
    return `Off: ${sMonth} ${s.getUTCDate()} – ${eMonth} ${e.getUTCDate()}`;
  }

  useEffect(() => {
    // Tick at the top of every minute so all clocks roll over together
    const next = 60_000 - (Date.now() % 60_000);
    const timeout = setTimeout(() => {
      setNow(new Date());
      const id = setInterval(() => setNow(new Date()), 60_000);
      // Stash the interval id on the timeout so the cleanup below can clear it
      (timeout as unknown as { _intervalId: ReturnType<typeof setInterval> })._intervalId = id;
    }, next);
    return () => {
      clearTimeout(timeout);
      const id = (timeout as unknown as { _intervalId?: ReturnType<typeof setInterval> })._intervalId;
      if (id) clearInterval(id);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
      {TEAM_LOCATIONS.map((m) => {
        const parts = new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: m.tz,
        }).formatToParts(now);
        const clock = parts
          .filter((p) => p.type !== "dayPeriod" && p.type !== "literal" || (p.type === "literal" && p.value === ":"))
          .map((p) => p.value)
          .join("");
        const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
        const isAM = dayPeriod.toUpperCase() === "AM";
        const isOut = outFirstNames.has(m.name.toLowerCase());

        // When out, tint the pill red so vacation pops; otherwise AM=amber, PM=sky
        const tintBg = isOut
          ? "bg-red-500/[0.10]"
          : isAM ? "bg-amber-500/[0.06]" : "bg-sky-500/[0.06]";
        const tintRing = isOut
          ? "ring-red-500/30"
          : isAM ? "ring-amber-500/20" : "ring-sky-500/15";

        return (
          <div
            key={m.name}
            className={`flex items-center justify-between gap-2 px-3 py-1.5 rounded-full ${tintBg} ring-1 ${tintRing} backdrop-blur-sm`}
            title={isOut ? `${m.name} is on vacation` : `${m.city} (${m.tz})`}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-foreground leading-tight truncate flex items-center gap-1">
                {isOut && <span className="shrink-0" aria-label="On vacation">🌴</span>}
                {m.name}
              </p>
              <p className={`text-[9px] text-muted-foreground/70 leading-tight ${isOut ? "whitespace-nowrap" : "truncate"}`}>
                {isOut
                  ? (() => {
                      const r = outByName.get(m.name.toLowerCase());
                      return r ? fmtRange(r.start, r.end) : "On vacation";
                    })()
                  : m.city}
              </p>
            </div>
            <p className={`text-[12px] font-mono tabular-nums shrink-0 ${isOut ? "text-muted-foreground/60 line-through" : "text-foreground/90"}`}>
              {clock}
              <span className={`ml-1 ${isOut ? "text-muted-foreground/60" : "text-muted-foreground"}`}>{dayPeriod}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}

function TeamFocusCard({ filterInitId }: { filterInitId: string | null }) {
  const { user, isAdmin } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekStart());
  const { foci, initiatives, addFocus, loading, weekLabel, isCurrentWeek } = useFocusBoard(selectedWeek);
  const userId = user?.id ?? "";
  const [open, setOpen] = useState(false);

  // Auto-open when a filter is active so the filtered results are visible
  useEffect(() => {
    if (filterInitId) setOpen(true);
  }, [filterInitId]);

  const others = useMemo(() => {
    const o = foci.filter((f) => f.user_id !== userId);
    return filterInitId ? o.filter((f) => f.quarterly_initiative_id === filterInitId) : o;
  }, [foci, userId, filterInitId]);

  const grouped = useMemo(() => {
    const map = new Map<string, { userId: string; email: string; items: typeof others }>();
    for (const f of others) {
      if (!map.has(f.user_id)) map.set(f.user_id, { userId: f.user_id, email: f.user_email, items: [] });
      map.get(f.user_id)!.items.push(f);
    }
    return [...map.values()].sort((a, b) => a.email.localeCompare(b.email));
  }, [others]);

  const initiativeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of initiatives) m.set(i.id, i.title);
    return m;
  }, [initiatives]);

  const total = others.length;
  const completed = others.filter((i) => i.completed).length;

  if (loading) return null;

  function displayName(email: string): string {
    const name = email.split("@")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
        className={[
          "w-full flex items-center justify-between gap-3 p-4 rounded-xl text-left transition-all cursor-pointer",
          "bg-gradient-to-b from-black/[0.04] to-black/[0.02] dark:from-white/[0.06] dark:to-white/[0.02]",
          "backdrop-blur-xl ring-1 ring-black/15 dark:ring-white/10",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_2px_12px_-4px_rgba(0,0,0,0.2)]",
          "hover:ring-white/20",
        ].join(" ")}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted text-muted-foreground shrink-0">
            <Users className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              Team's Focus
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {completed}/{total} completed
            </p>
          </div>
        </div>

        {/* Week selector — inline in card header */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSelectedWeek(shiftWeek(selectedWeek, -1)); }}
            className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (!isCurrentWeek) setSelectedWeek(getCurrentWeekStart()); }}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
              isCurrentWeek
                ? "bg-muted text-foreground"
                : "bg-muted/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            {weekLabel}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSelectedWeek(shiftWeek(selectedWeek, 1)); }}
            className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Next week"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ml-[34px] ${open ? "rotate-180" : ""}`} />
        </div>
      </div>

      {open && (
        <div className="divide-y divide-border/40 pt-1">
          {grouped.map((g) => (
            <TeammateBlock
              key={g.email}
              userId={g.userId}
              email={g.email}
              items={g.items}
              initiativeMap={initiativeMap}
              initiatives={initiatives}
              canAdd={isAdmin}
              onAdd={(title, initId) => addFocus(title, initId, g.userId, g.email)}
            />
          ))}
          {grouped.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No teammates have added focus items yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function TeammateBlock({
  userId: _teammateId,
  email,
  items,
  initiativeMap,
  initiatives,
  canAdd,
  onAdd,
}: {
  userId: string;
  email: string;
  items: ReturnType<typeof useFocusBoard>["foci"];
  initiativeMap: Map<string, string>;
  initiatives: ReturnType<typeof useFocusBoard>["initiatives"];
  canAdd: boolean;
  onAdd: (title: string, initiativeId: string | null) => Promise<void> | void;
}) {
  const [completedOpen, setCompletedOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newInitId, setNewInitId] = useState<string>("");
  const active = items.filter((i) => !i.completed);
  const completed = items.filter((i) => i.completed);

  function displayName(em: string): string {
    const name = em.split("@")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await onAdd(newTitle.trim(), newInitId || null);
    setNewTitle("");
    setNewInitId("");
    setShowAdd(false);
  }

  const renderItem = (item: typeof items[number]) => {
    const initiativeTitle = item.quarterly_initiative_id ? initiativeMap.get(item.quarterly_initiative_id) : null;
    return (
      <div key={item.id} className={`flex items-start gap-2 ${item.completed ? "opacity-50" : ""}`}>
        <span className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${item.completed ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
        <div className="min-w-0">
          <span className={`text-xs ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {item.title}
          </span>
          {initiativeTitle && (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Target className="h-2.5 w-2.5" />
              {initiativeTitle}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 py-3 first:pt-1 group/block">
      <div className="flex items-center gap-2.5">
        <div className="h-7 w-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold">
          {displayName(email).charAt(0)}
        </div>
        <span className="text-sm font-semibold text-foreground">{displayName(email)}</span>
        <span className="text-[11px] text-muted-foreground/70">
          {completed.length}/{items.length}
        </span>
        {canAdd && !showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="ml-auto opacity-0 group-hover/block:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
            aria-label={`Add focus for ${displayName(email)}`}
            title={`Add focus for ${displayName(email)}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {showAdd && (
        <div className="ml-9 flex items-center gap-2">
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={`Add focus for ${displayName(email)}...`}
            className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 border-b border-border/50 focus:border-foreground/40 outline-none py-1 transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setShowAdd(false); setNewTitle(""); setNewInitId(""); }
            }}
          />
          {initiatives.length > 0 && (
            <InitiativeSelect value={newInitId} onChange={setNewInitId} initiatives={initiatives} />
          )}
          <button onClick={handleAdd} disabled={!newTitle.trim()} className="text-xs font-medium text-foreground/80 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors">Add</button>
          <button onClick={() => { setShowAdd(false); setNewTitle(""); setNewInitId(""); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        </div>
      )}
      <div className="space-y-2 ml-9">
        {active.length > 0 && (
          <div className="space-y-0.5">
            {active.map(renderItem)}
          </div>
        )}
        {completed.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setCompletedOpen((o) => !o)}
              className="flex items-center gap-1 text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest hover:text-foreground transition-colors"
            >
              <ChevronDown className={`h-2.5 w-2.5 transition-transform ${completedOpen ? "" : "-rotate-90"}`} />
              Completed <span className="font-medium normal-case tracking-normal">{completed.length}</span>
            </button>
            {completedOpen && (
              <div className="space-y-0.5 mt-1.5">
                {completed.map(renderItem)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MyFocusItems({ filterInitId }: { filterInitId: string | null }) {
  const { user } = useAuth();
  const { foci, initiatives, addFocus, editFocus, removeFocus, toggleComplete, loading } = useFocusBoard();
  const userId = user?.id ?? "";
  const [completedOpen, setCompletedOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newInitId, setNewInitId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const myItems = useMemo(() => {
    const mine = foci.filter((f) => f.user_id === userId);
    return filterInitId ? mine.filter((f) => f.quarterly_initiative_id === filterInitId) : mine;
  }, [foci, userId, filterInitId]);
  const activeItems = useMemo(() => myItems.filter((i) => !i.completed), [myItems]);
  const completedItems = useMemo(() => myItems.filter((i) => i.completed), [myItems]);

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await addFocus(newTitle, newInitId || null);
    setNewTitle("");
    setNewInitId("");
    setShowAdd(false);
  }

  const initiativeMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of initiatives) m.set(i.id, i.title);
    return m;
  }, [initiatives]);

  if (loading) return null;

  const renderItem = (item: typeof myItems[number]) => {
    const initiativeTitle = item.quarterly_initiative_id ? initiativeMap.get(item.quarterly_initiative_id) : null;
    return (
      <div
        key={item.id}
        className={`flex items-start gap-2.5 py-1 group ${item.completed ? "opacity-50" : ""}`}
      >
        <Checkbox
          checked={item.completed}
          onCheckedChange={() => toggleComplete(item.id, item.completed)}
          className="shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {item.carried_over_from && (
              <RotateCcw className="h-3 w-3 text-amber-500 shrink-0" />
            )}
            {editingId === item.id ? (
              <input
                autoFocus
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => {
                  if (editingTitle.trim() && editingTitle !== item.title) editFocus(item.id, { title: editingTitle.trim() });
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (editingTitle.trim() && editingTitle !== item.title) editFocus(item.id, { title: editingTitle.trim() });
                    setEditingId(null);
                  }
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="flex-1 bg-transparent text-sm text-foreground border-b border-foreground/40 outline-none py-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => { setEditingId(item.id); setEditingTitle(item.title); }}
                className={`text-sm text-left cursor-text hover:text-primary transition-colors ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}
                title="Click to edit"
              >
                {item.title}
              </button>
            )}
          </div>
          {(initiativeTitle || editingId === item.id) && (
            <div className="mt-0.5">
              <ItemInitiativeChip
                currentId={item.quarterly_initiative_id}
                currentTitle={initiativeTitle}
                initiatives={initiatives}
                onChange={(newId) => editFocus(item.id, { initiativeId: newId })}
              />
            </div>
          )}
        </div>
        {editingId !== item.id && (
          <button
            onClick={() => removeFocus(item.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1 text-muted-foreground hover:text-red-500"
            aria-label="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Here's your focus for the week</p>

      {myItems.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground italic">No focus items this week.</p>
      )}

      {/* Active items */}
      {activeItems.length > 0 && (
        <div className="space-y-2">
          {activeItems.map(renderItem)}
        </div>
      )}

      {/* Add Focus — sits between active items and the Completed section */}
      {!showAdd && (
        <MicroExpander
          text="Add Focus"
          icon={<CirclePlus className="h-3.5 w-3.5" />}
          variant="outline"
          className="-ml-[6px] hover:border-input"
          onClick={() => setShowAdd(true)}
        />
      )}

      {showAdd && (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a focus for this week..."
            className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 border-b border-border/50 focus:border-foreground/40 outline-none py-1.5 transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") setShowAdd(false);
            }}
          />
          {initiatives.length > 0 && (
            <InitiativeSelect
              value={newInitId}
              onChange={setNewInitId}
              initiatives={initiatives}
            />
          )}
          <button
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            className="shrink-0 text-xs font-medium text-foreground/80 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            Add
          </button>
          <button
            onClick={() => { setShowAdd(false); setNewTitle(""); setNewInitId(""); }}
            className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Completed (collapsible) */}
      {completedItems.length > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setCompletedOpen((o) => !o)}
            className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${completedOpen ? "" : "-rotate-90"}`} />
            Completed
            <span className="font-medium normal-case tracking-normal text-muted-foreground/60">
              {completedItems.length}
            </span>
          </button>
          {completedOpen && (
            <div className="space-y-2 mt-2">
              {completedItems.map(renderItem)}
            </div>
          )}
        </div>
      )}
    </div>
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
