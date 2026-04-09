import { useState, useMemo } from "react";
import { BookingKPITracker } from "@/components/BookingKPITracker";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LabelList,
} from "recharts";
import { Loader2, Mail, BookOpen } from "lucide-react";
import { useSupabaseMetrics } from "@/hooks/use-supabase-metrics";
import { useKitMarketing } from "@/hooks/use-kit-marketing";
import { useGoogleAnalytics } from "@/hooks/use-google-analytics";
import { useSkoolScorecard } from "@/hooks/use-skool-scorecard";
import { useSkoolJoinsRange } from "@/hooks/use-skool-joins";
import { WebsiteChannelCard } from "@/components/WebsiteChannelCard";
import { LoadingDots } from "@/components/LoadingDots";
import { useCalendly } from "@/hooks/use-calendly";
import { DateRangePicker as SharedDateRangePicker, type DateRangeValue } from "@/components/DateRangePicker";

// ── Date range helpers ───────────────────────────────────────────────────────

// Date range helpers moved to shared DateRangePicker component

import { fmtPercent } from "@/lib/formatNumber";

// ── Small helpers ────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

const pct = fmtPercent;

// KIT returns open_rate and click_rate already as percentages (e.g. 38.53 = 38.53%)
function fmtRate(r: number | null | undefined): string {
  if (r == null) return "—";
  return `${r.toFixed(1)}%`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

// ── Source colours ───────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  Email:            "#3b82f6",
  "Welcome Email":  "#93c5fd",
  Website:          "#ec4899",
  "Website B":      "#f472b6",
  "Website C":      "#f9a8d4",
  "Skool A":        "#eab308",
  "Skool C":        "#facc15",
  "Skool P":        "#fde047",
  Masterclass:      "#f97316",
  Google:           "#ef4444",
};
const DEFAULT_COLOR = "#94a3b8";

/** Display-friendly names for booking sources */
const SOURCE_LABELS: Record<string, string> = {
  "Welcome Email": "Welcome Series",
  "Skool C": "Skool Classroom",
  "Skool P": "Skool Post",
  "Skool A": "Skool DM",
};
function sourceLabel(name: string): string {
  return SOURCE_LABELS[name] ?? name;
}


import { ChartTooltip } from "@/components/ChartTooltip";

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="rounded-lg bg-primary/10 p-1.5">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}


// ── Main ──────────────────────────────────────────────────────────────────────

export default function MarketingDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "booking-tracker">("overview");

  // Each section gets its own date range state via the shared component
  const [range, setRange] = useState<DateRangeValue>({ start: "", end: "", startDate: "", endDate: "" });
  const [emailRange, setEmailRange] = useState<DateRangeValue>({ start: "", end: "", startDate: "", endDate: "" });
  const [skoolRange, setSkoolRange] = useState<DateRangeValue>({ start: "", end: "", startDate: "", endDate: "" });

  const daysInRange = useMemo(() => {
    const ms = new Date(range.end).getTime() - new Date(range.start).getTime();
    return Math.max(1, Math.round(ms / 86400000));
  }, [range]);

  // Skool scorecard metrics
  const skoolScorecard = useSkoolScorecard();
  const skoolJoinsRange = useSkoolJoinsRange(skoolRange.startDate, skoolRange.endDate);

  // Data — each section uses its own date range
  const supabase = useSupabaseMetrics(range.start, range.end);
  const emailSupabase = useSupabaseMetrics(emailRange.start, emailRange.end);
  const skoolSupabase = useSupabaseMetrics(skoolRange.start, skoolRange.end);
  const kit = useKitMarketing(emailRange.startDate, emailRange.endDate);
  const ga = useGoogleAnalytics();
  const gaAuthed = true; // Service account handles auth — always available

  // Derived booking counts
  const skoolBookings = useMemo(() => {
    const skoolA = skoolSupabase.salesEventBreakdown.find((e) => e.name === "Skool A")?.qualified ?? 0;
    const skoolC = skoolSupabase.salesEventBreakdown.find((e) => e.name === "Skool C")?.qualified ?? 0;
    const skoolP = skoolSupabase.salesEventBreakdown.find((e) => e.name === "Skool P")?.qualified ?? 0;
    return { skoolA, skoolC, skoolP, total: skoolA + skoolC + skoolP };
  }, [skoolSupabase.salesEventBreakdown]);

  const websiteBookings = supabase.salesEventBreakdown.find((e) => e.name === "Website")?.qualified ?? 0;
  const emailBookings =
    (emailSupabase.salesEventBreakdown.find((e) => e.name === "Email")?.qualified ?? 0) +
    (emailSupabase.salesEventBreakdown.find((e) => e.name === "Welcome Email")?.qualified ?? 0);

  const avgPerDay = supabase.totalBookings > 0
    ? (supabase.totalBookings / daysInRange).toFixed(1)
    : "—";

  const totalWebViews = useMemo(() => {
    const views = ga.weeklyViews.filter((v): v is number => v !== "—");
    return views.reduce((s, v) => s + v, 0);
  }, [ga.weeklyViews]);

  const websiteBookingRate =
    totalWebViews > 0 && websiteBookings > 0
      ? ((websiteBookings / totalWebViews) * 100).toFixed(2) + "%"
      : "—";

  const totalBooked = supabase.totalBookings + supabase.caseyCancel;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ══ Tabs ══════════════════════════════════════════════════════════ */}
      <div className="flex gap-1 border-b border-border">
        {[
          { key: "overview", label: "Overview" },
          { key: "booking-tracker", label: "Booking KPI Tracker" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ══ Booking KPI Tracker ═══════════════════════════════════════════ */}
      {activeTab === "booking-tracker" && <BookingKPITracker />}

      {/* ══ Overview content ══════════════════════════════════════════════ */}
      {activeTab === "overview" && <div className="space-y-8">

      {/* ══ Unified Booking Card ═══════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">

        {/* Card header with date picker */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-foreground">Booking Overview</h3>
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md">Total Average: {avgPerDay}/day</span>
          </div>
          <SharedDateRangePicker onChange={setRange} />
        </div>

            {/* ── KPI row ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              {/* Qualified */}
              <div className="px-6 py-5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Qualified Bookings</p>
                <p className="text-3xl font-bold text-foreground">{supabase.isLoading ? <LoadingDots /> : fmt(supabase.totalBookings)}</p>
                <p className="text-xs text-muted-foreground mt-1">Passed country qualification</p>
                <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full w-full" />
                </div>
              </div>

              {/* Country disqualified */}
              <div className="px-6 py-5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Country Disqualified</p>
                <p className="text-3xl font-bold text-status-red">{supabase.isLoading ? <LoadingDots /> : fmt(supabase.caseyCancel)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {supabase.isLoading ? "" : totalBooked > 0
                    ? `${Math.round((supabase.caseyCancel / totalBooked) * 100)}% of total booked`
                    : "of total booked"}
                </p>
                <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-status-red rounded-full transition-all"
                    style={{ width: totalBooked > 0 ? `${Math.round((supabase.caseyCancel / totalBooked) * 100)}%` : "0%" }}
                  />
                </div>
              </div>

              {/* Invitee cancellations */}
              <div className="px-6 py-5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Invitee Cancellations</p>
                <p className="text-3xl font-bold text-status-yellow">{supabase.isLoading ? <LoadingDots /> : fmt(supabase.inviteeCancel)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {supabase.isLoading ? "" : `${pct(supabase.cancellationRate)} cancellation rate`}
                </p>
                <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-status-yellow rounded-full transition-all"
                    style={{ width: supabase.cancellationRate != null ? `${supabase.cancellationRate}%` : "0%" }}
                  />
                </div>
              </div>
            </div>

            {/* ── Charts row ──────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-border">

              {/* Bookings by source */}
              <div className="p-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Bookings by Source</p>
                <div style={{ height: 220 }}>
                  {supabase.isLoading ? (
                    <div className="flex items-center justify-center h-full"><LoadingDots /></div>
                  ) : supabase.salesEventBreakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No bookings in this period</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={supabase.salesEventBreakdown.map(e => ({ ...e, name: sourceLabel(e.name) }))}
                        layout="vertical"
                        margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={90} />
                        <Tooltip cursor={false} content={<ChartTooltip formatter={(v) => `${v} qualified bookings`} />} />
                        <Bar dataKey="qualified" radius={[0, 4, 4, 0]}>
                          {supabase.salesEventBreakdown.map((entry) => (
                            <Cell key={entry.name} fill={SOURCE_COLORS[entry.name] ?? DEFAULT_COLOR} />
                          ))}
                          <LabelList
                            dataKey="qualified"
                            position="insideRight"
                            style={{ fill: "#fff", fontSize: 12, fontWeight: 600 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Daily trend */}
              <div className="p-6">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Daily Booking Trend</p>
                <div style={{ height: 220 }}>
                  {supabase.isLoading ? (
                    <div className="flex items-center justify-center h-full"><LoadingDots /></div>
                  ) : supabase.dailyBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No bookings in this period</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={supabase.dailyBookings} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                        <defs>
                          <linearGradient id="bookingGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={fmtDate}
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          width={24}
                        />
                        <Tooltip cursor={false} content={<ChartTooltip formatter={(v) => `${v} bookings`} />} />
                        <Area
                          type="monotone"
                          dataKey="bookings"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fill="url(#bookingGrad)"
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
      </div>

      {/* ══ Website ═══════════════════════════════════════════════════════ */}
      <WebsiteChannelCard gaAuthed={gaAuthed} />

      {/* ══ Skool ════════════════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader icon={BookOpen} title="Skool Channel" sub="learn-ai community" />
            <SharedDateRangePicker onChange={setSkoolRange} />
          </div>
            <div className="space-y-3">
              {/* Live bookings from Supabase */}
              <div className="bg-muted/30 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Skool Bookings</p>
                  <p className="text-xl font-bold text-foreground mt-0.5">{skoolSupabase.isLoading ? <LoadingDots /> : fmt(skoolBookings.total)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {!skoolSupabase.isLoading && skoolSupabase.totalBookings > 0
                    ? `${Math.round((skoolBookings.total / skoolSupabase.totalBookings) * 100)}% of total`
                    : ""}
                </p>
              </div>

              {/* A / P / C breakdown */}
              {[
                { label: "Skool DM", value: skoolBookings.skoolA, color: "#eab308" },
                { label: "Skool Classroom", value: skoolBookings.skoolC, color: "#facc15" },
                { label: "Skool Post", value: skoolBookings.skoolP, color: "#fde047" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="inline-block rounded-sm shrink-0" style={{ width: 10, height: 10, background: color }} />
                  <span className="text-sm text-foreground flex-1">{label}</span>
                  <span className="text-sm font-semibold font-mono text-foreground">{skoolSupabase.isLoading ? <LoadingDots /> : fmt(value)}</span>
                  <div className="w-24 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: skoolBookings.total > 0 ? `${(value / skoolBookings.total) * 100}%` : "0%", background: color }} />
                  </div>
                </div>
              ))}

              {/* Scorecard metrics */}
              <div className="pt-2 border-t border-border grid grid-cols-3 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Booking Rate</p>
                  <p className="text-xl font-bold text-foreground">
                    {skoolScorecard.loading ? <LoadingDots /> : skoolScorecard.bookingRate ?? "—"}
                  </p>
                  {skoolScorecard.bookingRateMonth && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{skoolScorecard.bookingRateMonth}</p>
                  )}
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">Skool Joins</p>
                  <p className="text-xl font-bold text-foreground">
                    {skoolJoinsRange.loading ? <LoadingDots /> : skoolJoinsRange.joins != null ? fmt(skoolJoinsRange.joins) : "—"}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1">AAA Bitly Clicks</p>
                  <p className="text-xl font-bold text-foreground">
                    {skoolScorecard.loading ? <LoadingDots /> : skoolScorecard.skoolClicks ?? "—"}
                  </p>
                  {skoolScorecard.skoolClicksMonth && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{skoolScorecard.skoolClicksMonth}</p>
                  )}
                </div>
              </div>
            </div>
        </div>

      {/* ══ Email Channel Card ════════════════════════════════════════════ */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Email Channel</h3>
              <p className="text-xs text-muted-foreground">Kit broadcast performance</p>
            </div>
          </div>
          <SharedDateRangePicker onChange={setEmailRange} />
        </div>

            {/* ── Top row: True Active + Email → Bookings ──────────────── */}
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border">

              {/* True Active */}
              <div className="px-6 py-6 flex flex-col justify-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-3">True Active Subscribers</p>
                <p className="text-6xl font-bold text-foreground leading-none">{kit.loading ? <LoadingDots /> : fmt(kit.trueActiveSubscribers)}</p>
                <p className="text-xs text-muted-foreground mt-3">Engaged subscribers (excl. cold)</p>
              </div>

              {/* Email → Bookings */}
              <div className="px-6 py-6 border-l-4 border-l-primary bg-primary/[0.03]">
                <p className="text-[10px] text-primary uppercase tracking-wider font-semibold mb-4">Email → Bookings</p>
                {emailBookings > 0 ? (
                  <div className="grid grid-cols-3 items-center gap-4">
                    <div>
                      <p className="text-4xl font-bold text-foreground leading-none">{fmt(emailBookings)}</p>
                      <p className="text-xs text-muted-foreground mt-2">Qualified bookings from email</p>
                    </div>
                    <div className="flex justify-center">
                      <PieChart width={130} height={130}>
                        <Pie
                          data={[
                            { name: "Email", value: emailSupabase.salesEventBreakdown.find((e) => e.name === "Email")?.qualified ?? 0 },
                            { name: "Welcome Series", value: emailSupabase.salesEventBreakdown.find((e) => e.name === "Welcome Email")?.qualified ?? 0 },
                          ].filter((d) => d.value > 0)}
                          cx="50%" cy="50%"
                          innerRadius={38} outerRadius={60}
                          paddingAngle={3} dataKey="value"
                        >
                          <Cell fill="#3b82f6" />
                          <Cell fill="#93c5fd" />
                        </Pie>
                        <Tooltip
                          cursor={false}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            return (
                              <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
                                <p className="font-semibold text-foreground">{payload[0].name}</p>
                                <p className="text-muted-foreground">{fmt(payload[0].value as number)} bookings</p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "Email", value: emailSupabase.salesEventBreakdown.find((e) => e.name === "Email")?.qualified ?? 0, color: "#3b82f6" },
                        { label: "Welcome Series", value: emailSupabase.salesEventBreakdown.find((e) => e.name === "Welcome Email")?.qualified ?? 0, color: "#93c5fd" },
                      ].map(({ label, value, color }) => (
                        <div key={label}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="shrink-0 rounded-sm" style={{ width: 8, height: 8, background: color }} />
                            <span className="text-xs text-muted-foreground flex-1">{label}</span>
                            <span className="text-xs font-bold font-mono text-foreground">{fmt(value)}</span>
                            <span className="text-xs text-muted-foreground w-8 text-right">{Math.round((value / emailBookings) * 100)}%</span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden ml-3.5">
                            <div className="h-full rounded-full" style={{ width: `${Math.round((value / emailBookings) * 100)}%`, background: color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No email bookings in this period.</p>
                )}
              </div>
            </div>

            {/* ── Secondary KPIs ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border border-b border-border">
              <div className="px-5 py-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Cold Subscribers</p>
                <p className="text-2xl font-bold text-blue-500">{kit.loading ? <LoadingDots /> : fmt(kit.coldSubscribers)}</p>
                <p className="text-xs text-muted-foreground mt-1">~1–2% est. accuracy</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Total List</p>
                <p className="text-2xl font-bold text-foreground">{kit.loading ? <LoadingDots /> : fmt(kit.activeSubscribers)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {kit.newSubscribers != null ? `+${fmt(kit.newSubscribers)} new this period` : "All subscribers"}
                </p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Avg Open Rate</p>
                <p className="text-2xl font-bold text-foreground">{kit.loading ? <LoadingDots /> : fmtRate(kit.avgOpenRate)}</p>
                <p className="text-xs text-muted-foreground mt-1">{kit.broadcasts.length} broadcasts</p>
              </div>
              <div className="px-5 py-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Avg Click Rate</p>
                <p className="text-2xl font-bold text-foreground">{kit.loading ? <LoadingDots /> : fmtRate(kit.avgClickRate)}</p>
                <p className="text-xs text-muted-foreground mt-1">{fmt(kit.totalRecipients)} total recipients</p>
              </div>
            </div>

            {/* ── Broadcasts table ─────────────────────────────────────── */}
            {kit.broadcasts.length > 0 ? (
              <>
                <div className="grid grid-cols-[1fr_70px_90px_70px_70px_70px_80px] gap-2 px-5 py-2.5 bg-muted/20 border-b border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Subject</span>
                  <span className="text-center">Sent</span>
                  <span className="text-right">Recipients</span>
                  <span className="text-right">Opens</span>
                  <span className="text-right">Open %</span>
                  <span className="text-right">Click %</span>
                  <span className="text-right">Booking Clicks</span>
                </div>
                <div className="overflow-y-auto max-h-72">
                  {kit.broadcasts.map((b) => (
                    <a
                      key={b.id}
                      href={b.publicationId ? `https://app.kit.com/publications/${b.publicationId}/reports/overview` : undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="grid grid-cols-[1fr_70px_90px_70px_70px_70px_80px] gap-2 px-5 py-2.5 items-center border-b border-border/30 hover:bg-muted/10 transition-colors last:border-0"
                    >
                      <span className="text-sm text-foreground truncate hover:text-primary transition-colors" title={b.subject}>{b.subject}</span>
                      <span className="text-xs text-muted-foreground text-center">{fmtDate(b.sentAt)}</span>
                      <span className="text-xs font-mono text-foreground text-right">{fmt(b.recipients)}</span>
                      <span className="text-xs font-mono text-foreground text-right">{fmt(b.opens)}</span>
                      <span className="text-xs font-mono text-muted-foreground text-right">{fmtRate(b.openRate)}</span>
                      <span className="text-xs font-mono text-muted-foreground text-right">{fmtRate(b.clickRate)}</span>
                      <span className="text-xs font-mono text-right">
                        {b.calendlyClicks > 0
                          ? <span className="text-primary font-semibold">{fmt(b.calendlyClicks)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </span>
                    </a>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground px-6 py-4">No broadcasts sent in this period.</p>
            )}
      </div>

      </div>} {/* end overview */}
    </div>
  );
}

