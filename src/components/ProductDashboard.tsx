import { useCircle } from "@/hooks/use-circle";
import { useCircleCharts } from "@/hooks/use-circle-charts";
import { useTallyNps } from "@/hooks/use-tally-nps";
import { Card, CardContent } from "@/components/ui/card";
import { formatDay } from "@/lib/dates";
import {
  Users,
  UserPlus,
  ExternalLink,
  Loader2,
  AlertCircle,
  Star,
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
  ResponsiveContainer,
} from "recharts";

import { GRID, TICK, TOOLTIP_STYLE } from "@/lib/chart-theme";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" });
}

// ── NPS gauge ─────────────────────────────────────────────────

function NpsGauge({ score }: { score: number }) {
  const clamped = Math.max(-100, Math.min(100, score));
  const pct = ((clamped + 100) / 200) * 100;
  const color = clamped >= 50 ? "bg-status-green" : clamped >= 0 ? "bg-status-yellow" : "bg-status-red";
  const textColor = clamped >= 50 ? "text-status-green" : clamped >= 0 ? "text-status-yellow" : "text-status-red";

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
  const { memberGrowth, postActivity, isLoading: chartsLoading } = useCircleCharts();
  const { results: npsResults, loading: npsLoading, error: npsError } = useTallyNps();

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
              <h3 className="text-sm font-semibold text-foreground">NPS Scores</h3>
              <p className="text-xs text-muted-foreground">Member satisfaction — Tally Forms</p>
            </div>
            {npsError && (
              <span className="flex items-center gap-1 text-xs text-status-red ml-auto">
                <AlertCircle className="h-3 w-3" /> {npsError}
              </span>
            )}
            {npsLoading && npsResults.length === 0 && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
            )}
          </div>

          {npsResults.length > 0 && (
            <div className={`grid gap-6 ${npsResults.length > 1 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-sm"}`}>
              {npsResults.map((r, i) => (
                <div key={r.formId} className={`space-y-4 ${i > 0 ? "md:pl-6 md:border-l border-border" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{r.formName}</p>
                      <p className="text-[11px] text-muted-foreground">{r.totalResponses} responses</p>
                    </div>
                    {r.loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                  {r.error ? (
                    <p className="text-xs text-status-red">{r.error}</p>
                  ) : (
                    <>
                      <NpsGauge score={r.score} />
                      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
                        <div className="text-center">
                          <p className="text-lg font-bold text-status-green">{r.promoters}</p>
                          <p className="text-[10px] text-muted-foreground">Promoters</p>
                          <p className="text-[10px] text-muted-foreground/60">9–10</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-status-yellow">{r.passives}</p>
                          <p className="text-[10px] text-muted-foreground">Passives</p>
                          <p className="text-[10px] text-muted-foreground/60">7–8</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-status-red">{r.detractors}</p>
                          <p className="text-[10px] text-muted-foreground">Detractors</p>
                          <p className="text-[10px] text-muted-foreground/60">0–6</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Community Card ───────────────────────────────────── */}
      <Card className="card-shadow">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <h3 className="text-sm font-semibold text-foreground">Community — Circle.so</h3>
            {circleError && (
              <span className="flex items-center gap-1 text-xs text-status-red ml-auto">
                <AlertCircle className="h-3 w-3" /> API error
              </span>
            )}
          </div>

          {/* Stat numbers */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Total Members</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {circleLoading && totalMembers === null
                  ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  : (totalMembers ?? "—").toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">All time</p>
            </div>
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <UserPlus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">New This Month</span>
              </div>
              <p className="text-3xl font-bold text-foreground">
                {circleLoading && newMembersThisMonth === null
                  ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  : (newMembersThisMonth ?? "—").toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">March 2026</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">New Members — Daily (last 30 days)</p>
              {chartsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={memberGrowth}>
                    <defs>
                      <linearGradient id="memberGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Date: ${v}`} formatter={(v: number) => [v, "New members"]} />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#memberGrad)" dot={false} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-3">Daily Post Activity (last 30 days)</p>
              {chartsLoading ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={postActivity} barSize={10}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} interval={4} />
                    <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Date: ${v}`} formatter={(v: number) => [v, "Posts"]} />
                    <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Upcoming Events ──────────────────────────────────── */}
      <Card className="card-shadow">
        <CardContent className="p-5">
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
        </CardContent>
      </Card>

    </div>
  );
}
