import { useState, useMemo, useRef, useEffect } from "react";
import { useCircle } from "@/hooks/use-circle";
import { useCircleCharts } from "@/hooks/use-circle-charts";
import { useTallyNps } from "@/hooks/use-tally-nps";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { DateRangePicker, type DateRangeValue } from "@/components/DateRangePicker";
import type { DateRange } from "react-day-picker";
import { toNZDate, formatDay } from "@/lib/dates";
import {
  Users,
  UserPlus,
  ExternalLink,
  Loader2,
  AlertCircle,
  Star,
  ChevronDown,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { GRID, TICK, TOOLTIP_STYLE } from "@/lib/chart-theme";
import { LoadingDots } from "@/components/LoadingDots";

const NPS_COLORS: Record<string, string> = {
  "2 months": "#a855f7",  // purple-500
  "6 months": "#3b82f6",  // blue-500
};

// ── NPS chart time range selector ────────────────────────────

type NpsPreset = "90d" | "180d" | "all" | "custom";

const NPS_PRESETS: { value: NpsPreset; label: string }[] = [
  { value: "90d", label: "90 Days" },
  { value: "180d", label: "180 Days" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom" },
];

function npsPresetToRange(preset: NpsPreset): { startDate: string; endDate: string } {
  if (preset === "all") return { startDate: "", endDate: "" };
  const today = toNZDate(new Date().toISOString());
  const d = new Date();
  switch (preset) {
    case "90d": d.setDate(d.getDate() - 90); break;
    case "180d": d.setDate(d.getDate() - 180); break;
    default: return { startDate: "", endDate: "" };
  }
  return { startDate: toNZDate(d.toISOString()), endDate: today };
}

function NpsRangeSelector({ onChange }: { onChange: (range: { startDate: string; endDate: string }) => void }) {
  const [active, setActive] = useState<NpsPreset>("90d");
  const [showCal, setShowCal] = useState(false);
  const [calRange, setCalRange] = useState<DateRange | undefined>();
  const ref = useRef<HTMLDivElement>(null);

  // Fire initial range on mount
  useEffect(() => { onChange(npsPresetToRange("90d")); }, []);

  // Close calendar on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowCal(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function selectPreset(p: NpsPreset) {
    setActive(p);
    setShowCal(false);
    if (p !== "custom") {
      onChange(npsPresetToRange(p));
    } else {
      setShowCal(true);
    }
  }

  function handleCalSelect(range: DateRange | undefined) {
    setCalRange(range);
    if (range?.from && range?.to) {
      onChange({
        startDate: toNZDate(range.from.toISOString()),
        endDate: toNZDate(range.to.toISOString()),
      });
      setShowCal(false);
    }
  }

  return (
    <div className="relative flex items-center gap-1" ref={ref}>
      {NPS_PRESETS.map((p) => (
        <button
          key={p.value}
          onClick={() => selectPreset(p.value)}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors ${
            active === p.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {p.label}
          {p.value === "custom" && <ChevronDown className="inline h-3 w-3 ml-0.5" />}
        </button>
      ))}
      {showCal && (
        <div className="fixed right-8 z-50 bg-popover border border-border rounded-lg shadow-lg p-2" style={{ marginTop: 4 }}>
          <Calendar
            mode="range"
            selected={calRange}
            onSelect={handleCalSelect}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
          />
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" });
}

// ── NPS gauge ─────────────────────────────────────────────────

function NpsGauge({ score }: { score: number }) {
  const clamped = Math.max(-100, Math.min(100, score));
  const pct = ((clamped + 100) / 200) * 100;
  const color = clamped > 0 ? "bg-status-green" : clamped === 0 ? "bg-status-yellow" : "bg-status-red";
  const textColor = clamped > 0 ? "text-status-green" : clamped === 0 ? "text-status-yellow" : "text-status-red";

  return (
    <div className="space-y-1.5">
      <div className="flex items-end gap-1.5">
        <span className={`text-4xl font-bold tracking-tight ${textColor}`}>
          {clamped > 0 ? "+" : ""}{clamped}
        </span>
        <span className="text-xs text-muted-foreground mb-1.5">NPS</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/60">
        <span>-100</span>
        <span>0</span>
        <span>+100</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function ProductDashboard() {
  const { totalMembers, newMembersThisMonth, upcomingEvents, isLoading: circleLoading, isError: circleError } = useCircle();
  const { memberGrowth, postActivity, rawPosts, isLoading: chartsLoading } = useCircleCharts();
  const { results: npsResults, loading: npsLoading, error: npsError } = useTallyNps();
  const [chartRange, setChartRange] = useState<{ startDate: string; endDate: string }>({ startDate: "", endDate: "" });
  const [communityRange, setCommunityRange] = useState<DateRangeValue>({ start: "", end: "", startDate: "", endDate: "" });

  // Filter raw posts by community range
  const filteredPosts = useMemo(() => {
    if (!communityRange.startDate || !communityRange.endDate) return rawPosts;
    return rawPosts.filter((p) => {
      const date = p.created_at?.slice(0, 10);
      return date >= communityRange.startDate && date <= communityRange.endDate;
    });
  }, [rawPosts, communityRange.startDate, communityRange.endDate]);

  // Compute space activity from filtered posts
  const filteredSpaceActivity = useMemo(() => {
    const map: Record<string, number> = {};
    filteredPosts.forEach((p) => {
      const name = p.space_name || "Unknown";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [filteredPosts]);

  // Compute top posts from filtered posts
  const filteredTopPosts = useMemo(() => {
    return filteredPosts
      .map((p) => ({
        name: p.name?.length > 40 ? p.name.slice(0, 40) + "…" : p.name,
        likes: p.likes_count || 0,
        comments: p.comments_count || 0,
        space: p.space_name,
        url: p.url,
      }))
      .filter((p) => p.likes + p.comments > 0)
      .sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments))
      .slice(0, 10);
  }, [filteredPosts]);

  // Filter community charts by selected range
  const filteredMemberGrowth = useMemo(() => {
    if (!communityRange.startDate || !communityRange.endDate) return memberGrowth;
    return memberGrowth.filter((d) => d.date >= communityRange.startDate && d.date <= communityRange.endDate);
  }, [memberGrowth, communityRange.startDate, communityRange.endDate]);

  const filteredPostActivity = useMemo(() => {
    if (!communityRange.startDate || !communityRange.endDate) return postActivity;
    return postActivity.filter((d) => d.date >= communityRange.startDate && d.date <= communityRange.endDate);
  }, [postActivity, communityRange.startDate, communityRange.endDate]);

  // Update "New This Month" stat based on range
  const filteredNewMembers = useMemo(() => {
    if (!communityRange.startDate || !communityRange.endDate) return newMembersThisMonth;
    return filteredMemberGrowth.reduce((sum, d) => sum + d.count, 0);
  }, [filteredMemberGrowth, communityRange.startDate, communityRange.endDate, newMembersThisMonth]);

  const formKeys = useMemo(() =>
    npsResults.map((r) => r.formName.replace("NPS Score Tracking - ", "").replace("NPS Score Tracking", "").trim()),
    [npsResults]
  );

  // Build chart data: merge daily NPS from all forms, filtered by chart range
  const chartData = useMemo(() => {
    if (npsResults.length === 0) return [];

    const dateMap = new Map<string, Record<string, number>>();
    for (const r of npsResults) {
      const key = r.formName.replace("NPS Score Tracking - ", "").replace("NPS Score Tracking", "").trim();
      for (const pt of r.dailyNps) {
        const existing = dateMap.get(pt.date) || {};
        existing[key] = pt.score;
        dateMap.set(pt.date, existing);
      }
    }

    const sorted = [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    // Filter to chart range (x-axis zoom only — the NPS values are still cumulative all-time)
    const startFilter = chartRange.startDate || "";
    const endFilter = chartRange.endDate || "";
    const filtered = sorted.filter(([date]) => {
      if (startFilter && date < startFilter) return false;
      if (endFilter && date > endFilter) return false;
      return true;
    });

    const result: Record<string, string | number>[] = [];
    const lastVal: Record<string, number> = {};

    // Seed lastVal from data before the filter range so lines don't start from 0
    for (const [date, vals] of sorted) {
      if (startFilter && date >= startFilter) break;
      for (const key of formKeys) {
        if (vals[key] !== undefined) lastVal[key] = vals[key];
      }
    }

    for (const [date, vals] of filtered) {
      const point: Record<string, string | number> = { date };
      for (const key of formKeys) {
        if (vals[key] !== undefined) lastVal[key] = vals[key];
        if (lastVal[key] !== undefined) point[key] = lastVal[key];
      }
      result.push(point);
    }
    return result;
  }, [npsResults, formKeys, chartRange.startDate, chartRange.endDate]);

  return (
    <div className="space-y-5">

      {/* ── NPS Card ─────────────────────────────────────────── */}
      <Card className="card-shadow">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <Star className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">NPS Scores</h3>
              <p className="text-xs text-muted-foreground">Member satisfaction — Tally Forms</p>
            </div>
            {npsError && (
              <span className="flex items-center gap-1 text-xs text-status-red ml-auto">
                <AlertCircle className="h-3 w-3" /> {npsError}
              </span>
            )}
            {npsLoading && npsResults.length === 0 && (
              <LoadingDots className="ml-auto" />
            )}
          </div>

          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 min-h-[200px]">
            {npsLoading && npsResults.length === 0 ? (
              <>
                {/* Skeleton placeholders while loading */}
                {[0, 1].map((i) => (
                  <div key={i} className={`space-y-4 ${i > 0 ? "md:pl-6 md:border-l border-border" : ""}`}>
                    <div>
                      <p className="text-lg font-semibold text-foreground">NPS - {i === 0 ? "6" : "2"} Months</p>
                      <p className="text-[11px] text-muted-foreground"><LoadingDots /></p>
                    </div>
                    <NpsGauge score={0} />
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
                      <div className="text-center">
                        <p className="text-lg font-bold text-status-red"><LoadingDots /></p>
                        <p className="text-[10px] text-muted-foreground">Detractors</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-status-yellow"><LoadingDots /></p>
                        <p className="text-[10px] text-muted-foreground">Passives</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-status-green"><LoadingDots /></p>
                        <p className="text-[10px] text-muted-foreground">Promoters</p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              npsResults.map((r, i) => (
                <div key={r.formId} className={`space-y-4 ${i > 0 ? "md:pl-6 md:border-l border-border" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold text-foreground">{r.formName.replace(/NPS Score Tracking\s*-?\s*/i, "").replace(/(\d+)\s*months?/i, (_, n) => `${n} Months`)}</p>
                      <p className="text-[11px] text-muted-foreground">{npsLoading ? <LoadingDots /> : `${r.totalResponses} responses`}</p>
                    </div>
                  </div>
                  {r.error ? (
                    <p className="text-xs text-status-red">{r.error}</p>
                  ) : (
                    <>
                      <NpsGauge score={r.score} />
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
                        <div className="text-center">
                          <p className="text-lg font-bold text-status-red">{npsLoading ? <LoadingDots /> : r.detractors}</p>
                          <p className="text-[10px] text-muted-foreground">Detractors</p>
                          <p className="text-[10px] text-muted-foreground/60">0–6</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-status-yellow">{npsLoading ? <LoadingDots /> : r.passives}</p>
                          <p className="text-[10px] text-muted-foreground">Passives</p>
                          <p className="text-[10px] text-muted-foreground/60">7–8</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-status-green">{npsLoading ? <LoadingDots /> : r.promoters}</p>
                          <p className="text-[10px] text-muted-foreground">Promoters</p>
                          <p className="text-[10px] text-muted-foreground/60">9–10</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>

        {/* ── NPS Trend Chart — attached below NPS cards ──────── */}
        {npsResults.length > 0 && (
          <div className="border-t border-border px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground">NPS Score Over Time</p>
              <NpsRangeSelector onChange={setChartRange} />
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                <defs>
                  {formKeys.map((key) => (
                    <linearGradient key={key} id={`npsGrad-${key.replace(/\s/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={NPS_COLORS[key] || "#8884d8"} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={NPS_COLORS[key] || "#8884d8"} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={false}
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => `Date: ${v}`}
                  formatter={(v: number, name: string) => [`${v > 0 ? "+" : ""}${v}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {formKeys.map((key) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key}
                    stroke={NPS_COLORS[key] || "#8884d8"}
                    strokeWidth={2}
                    fill={`url(#npsGrad-${key.replace(/\s/g, "")})`}
                    dot={false}
                    activeDot={{ r: 4, fill: NPS_COLORS[key] || "#8884d8" }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* ── Community Card ───────────────────────────────────── */}
      <Card className="card-shadow">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Community — Circle.so</h3>
              {circleError && (
                <span className="flex items-center gap-1 text-xs text-status-red">
                  <AlertCircle className="h-3 w-3" /> API error
                </span>
              )}
            </div>
            <DateRangePicker onChange={setCommunityRange} />
          </div>

          {/* Top row: Total Members (1/3) + Post Activity (2/3) */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Total Members</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {circleLoading && totalMembers === null
                  ? <LoadingDots />
                  : (totalMembers ?? "—").toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">All time</p>
            </div>
            <div className="col-span-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                  <Star className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Post Activity</span>
              </div>
              {chartsLoading ? (
                <div className="h-[100px] flex items-center justify-center"><LoadingDots /></div>
              ) : (
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={filteredPostActivity} barSize={6}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 9, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 9, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} width={25} />
                    <Tooltip cursor={false} contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Date: ${v}`} formatter={(v: number) => [v, "Posts"]} />
                    <Bar dataKey="count" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* New Members — stat + chart connected */}
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <UserPlus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <span className="text-xs font-medium text-muted-foreground">New Members</span>
                  <p className="text-2xl font-bold text-foreground leading-tight">
                    {circleLoading && newMembersThisMonth === null
                      ? <LoadingDots />
                      : (filteredNewMembers ?? "—").toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            {chartsLoading ? (
              <div className="flex items-center justify-center h-[160px]">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={filteredMemberGrowth}>
                  <defs>
                    <linearGradient id="memberGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={false} contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Date: ${v}`} formatter={(v: number) => [v, "New members"]} />
                  <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fill="url(#memberGrad)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>

        {/* ── Most Active Spaces + Top Posts ─────────────────── */}
        <div className="border-t border-border px-5 py-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Active Spaces */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">Most Active Spaces</p>
              {chartsLoading ? (
                <div className="flex items-center justify-center h-32"><LoadingDots /></div>
              ) : filteredSpaceActivity.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No data</p>
              ) : (
                <div className="space-y-2">
                  {filteredSpaceActivity.slice(0, 6).map((s) => {
                    const maxCount = filteredSpaceActivity[0]?.count || 1;
                    return (
                      <div key={s.name} className="flex items-center gap-3">
                        <span className="text-xs text-foreground truncate w-32 shrink-0">{s.name}</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${(s.count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground w-8 text-right shrink-0">{s.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Posts */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">Top Posts by Engagement</p>
              {chartsLoading ? (
                <div className="flex items-center justify-center h-32"><LoadingDots /></div>
              ) : filteredTopPosts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No data</p>
              ) : (
                <div className="space-y-2">
                  {filteredTopPosts.slice(0, 6).map((p, i) => (
                    <a
                      key={i}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <span className="text-xs font-mono text-muted-foreground/50 w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground truncate group-hover:text-primary transition-colors">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground">{p.space}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[10px] text-muted-foreground">
                        <span>❤️ {p.likes}</span>
                        <span>💬 {p.comments}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Upcoming Events — attached to Community card ───── */}
        <div className="border-t border-border px-5 py-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming Events</h3>
          {circleLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No upcoming events</p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="min-w-[48px] text-center">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                      {new Date(event.starts_at).toLocaleDateString("en-NZ", { month: "short" })}
                    </p>
                    <p className="text-xl font-bold text-foreground leading-tight">
                      {new Date(event.starts_at).getDate()}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{event.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatTime(event.starts_at)} · {event.host}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{event.space?.name}</p>
                  </div>
                  <a href={event.url} target="_blank" rel="noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

    </div>
  );
}
