import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useCoachesMeetings, useCircleSLA } from "@/hooks/use-coaches";
import type { MeetingRecord, CirclePost } from "@/hooks/use-coaches";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Clock,
  CheckCircle2,
  CalendarDays,
  Users,
  ExternalLink,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ── Colour helpers ────────────────────────────────────────────

const COACH_PALETTE = [
  { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500", hex: "#3b82f6" },
  { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500", hex: "#a855f7" },
  { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", hex: "#10b981" },
  { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500", hex: "#f97316" },
  { bg: "bg-rose-100", text: "text-rose-700", dot: "bg-rose-500", hex: "#f43f5e" },
  { bg: "bg-teal-100", text: "text-teal-700", dot: "bg-teal-500", hex: "#14b8a6" },
  { bg: "bg-indigo-100", text: "text-indigo-700", dot: "bg-indigo-500", hex: "#6366f1" },
  { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500", hex: "#f59e0b" },
];

function coachColour(name: string) {
  if (!name) return COACH_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return COACH_PALETTE[hash % COACH_PALETTE.length];
}

// ── Date helpers ──────────────────────────────────────────────

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatTime(isoString?: string): string {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return isoString; }
}

function formatElapsed(createdStr?: string): string {
  if (!createdStr) return "—";
  try {
    const mins = Math.floor((Date.now() - new Date(createdStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return "—"; }
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({
  label, value, sub, accent, icon: Icon,
}: {
  label: string; value: string | number; sub?: string; accent?: string; icon?: React.ElementType;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-3xl font-bold tracking-tight ${accent ?? "text-foreground"}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          {Icon && (
            <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status?: string[] | string }) {
  const s = Array.isArray(status) ? status[0] : status;
  if (!s) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">Upcoming</span>;
  if (s === "Completed") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">Completed</span>;
  if (s === "Cancelled") return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Cancelled</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">{s}</span>;
}

function SectionHeader({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ── SLA helpers ───────────────────────────────────────────────

function slaColour(mins?: number, status?: string) {
  if (status !== "Complete") return { border: "border-amber-300", badge: "bg-amber-100 text-amber-700" };
  if (!mins) return { border: "border-border", badge: "bg-gray-100 text-gray-600" };
  if (mins < 240) return { border: "border-emerald-300", badge: "bg-emerald-100 text-emerald-700" };
  if (mins < 720) return { border: "border-emerald-300", badge: "bg-emerald-100 text-emerald-700" };
  if (mins < 1440) return { border: "border-amber-300", badge: "bg-amber-100 text-amber-700" };
  return { border: "border-red-300", badge: "bg-red-100 text-red-700" };
}

// ── Monthly Calendar ──────────────────────────────────────────

function getMonthGrid(year: number, month: number): Array<{ iso: string; day: number; isCurrentMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start grid on Monday
  const startOffset = (firstDay.getDay() + 6) % 7;
  const grid: Array<{ iso: string; day: number; isCurrentMonth: boolean }> = [];

  for (let i = 0; i < startOffset; i++) {
    const d = new Date(year, month, 1 - (startOffset - i));
    grid.push({ iso: fmtDate(d), day: d.getDate(), isCurrentMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    grid.push({ iso: fmtDate(new Date(year, month, d)), day: d, isCurrentMonth: true });
  }
  // Fill to complete the last row (always end on Sunday = 7 cols)
  while (grid.length % 7 !== 0) {
    const d = new Date(year, month + 1, grid.length - lastDay.getDate() - startOffset + 1);
    grid.push({ iso: fmtDate(d), day: d.getDate(), isCurrentMonth: false });
  }
  return grid;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Main component ────────────────────────────────────────────

export default function CoachesDashboard() {
  const { todaysMeetings, monthlyMeetings, loading: meetingsLoading, error: meetingsError } = useCoachesMeetings();
  const { posts: circlePosts, loading: circleLoading, error: circleError } = useCircleSLA();

  const today = useMemo(() => todayIso(), []);
  const now = new Date();
  const [expandedDay, setExpandedDay] = useState<string | null>(today);

  // ── Stat calculations ──────────────────────────────────────

  const totalToday = todaysMeetings.length;

  const completedToday = useMemo(
    () => todaysMeetings.filter((r) => Array.isArray(r.fields["Meeting Status"]) && r.fields["Meeting Status"].includes("Completed")).length,
    [todaysMeetings]
  );

  const upcomingToday = useMemo(
    () => todaysMeetings.filter((r) => {
      const s = r.fields["Meeting Status"];
      if (!Array.isArray(s)) return true;
      return !s.includes("Completed") && !s.includes("Cancelled");
    }).length,
    [todaysMeetings]
  );

  const avgResponseTime = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const relevant = circlePosts.filter((p) => {
      if (p.fields["Status"] !== "Complete") return false;
      if (!p.fields["Time Difference"]) return false;
      const created = p.fields["Created"] ? new Date(p.fields["Created"]).getTime() : 0;
      return created > thirtyDaysAgo;
    });
    if (!relevant.length) return null;
    return Math.round(relevant.reduce((acc, p) => acc + (p.fields["Time Difference"] ?? 0), 0) / relevant.length);
  }, [circlePosts]);

  // ── Circle SLA chart data ─────────────────────────────────

  const slaChartData = useMemo(() => {
    const buckets = [
      { label: "< 4h", min: 0, max: 240, colour: "#10b981" },
      { label: "4–12h", min: 240, max: 720, colour: "#10b981" },
      { label: "12–24h", min: 720, max: 1440, colour: "#f59e0b" },
      { label: "> 24h", min: 1440, max: Infinity, colour: "#f43f5e" },
      { label: "Pending", min: -1, max: -1, colour: "#94a3b8" },
    ];

    const counts = buckets.map((b) => ({ ...b, count: 0 }));

    circlePosts.forEach((p) => {
      const f = p.fields;
      if (f["Status"] !== "Complete") {
        counts[4].count++;
      } else {
        const mins = f["Time Difference"] ?? 0;
        const bucket = counts.find((b, i) => i < 4 && mins >= b.min && mins < b.max);
        if (bucket) bucket.count++;
      }
    });

    return counts;
  }, [circlePosts]);

  // ── Monthly calendar grouping ─────────────────────────────

  const monthGrid = useMemo(() => getMonthGrid(now.getFullYear(), now.getMonth()), []);

  const dayMap = useMemo(() => {
    const map: Record<string, Array<{ id: string; fields: MeetingRecord }>> = {};
    monthlyMeetings.forEach((r) => {
      const date = r.fields["Event Start Date Only (NZT)"] ?? "";
      const iso = date.length === 10 ? date : "";
      if (iso) {
        if (!map[iso]) map[iso] = [];
        map[iso].push(r);
      }
    });
    // Sort calls within each day by start time
    Object.values(map).forEach((calls) =>
      calls.sort((a, b) =>
        (a.fields["Event Start Time (NZT)"] ?? "").localeCompare(b.fields["Event Start Time (NZT)"] ?? "")
      )
    );
    return map;
  }, [monthlyMeetings]);

  const loading = meetingsLoading || circleLoading;
  const error = meetingsError ?? circleError;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-sm">Loading coaches data…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-red-600">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  const monthLabel = now.toLocaleString("en-NZ", { month: "long", year: "numeric" });
  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      {/* ── Stats bar ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Calls Today" value={totalToday} icon={CalendarDays} />
        <StatCard label="Completed Today" value={completedToday} accent="text-emerald-600" icon={CheckCircle2} />
        <StatCard label="Upcoming Today" value={upcomingToday} accent="text-blue-600" icon={Clock} />
        <StatCard
          label="Avg Circle Response"
          value={avgResponseTime !== null ? `${avgResponseTime}m` : "—"}
          sub="Last 30 days · Complete posts"
          accent={
            avgResponseTime === null ? "text-foreground"
              : avgResponseTime < 720 ? "text-emerald-600"
              : avgResponseTime < 1440 ? "text-amber-600"
              : "text-red-600"
          }
          icon={Users}
        />
      </div>

      {/* ── Circle SLA Monitor ───────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="p-5">
          <SectionHeader icon={Clock} title="Circle SLA Monitor" sub={`${circlePosts.length} recent posts`} />

          {circlePosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No Circle posts found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              {/* Chart */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Response Time Distribution</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={slaChartData} barSize={32} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      formatter={(val) => [`${val} posts`, "Count"]}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {slaChartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.colour} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-3">
                  {[
                    { label: "< 4h", colour: "#10b981" },
                    { label: "4–12h", colour: "#10b981" },
                    { label: "12–24h", colour: "#f59e0b" },
                    { label: "> 24h", colour: "#f43f5e" },
                    { label: "Pending", colour: "#94a3b8" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.colour }} />
                      <span className="text-[10px] text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Post list */}
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {circlePosts.map((p) => {
                  const f = p.fields;
                  const isPending = f["Status"] !== "Complete";
                  const timeDiff = f["Time Difference"];
                  const colours = slaColour(timeDiff, f["Status"]);
                  const coach = Array.isArray(f["Coach"]) ? f["Coach"].join(", ") : (f["Coach"] ?? null);
                  const isDevHelp = (f["Help Subject"] ?? "").toLowerCase().includes("dev");

                  return (
                    <div key={p.id} className={`rounded-lg border p-3 ${colours.border} ${isPending ? "bg-amber-50/40" : "bg-card"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide shrink-0 ${isDevHelp ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                            {isDevHelp ? "Dev Help" : "Acq Help"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{f["Name"] ?? "Unknown"}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{f["Help Subject"] ?? "—"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isPending ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Pending</span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">Complete</span>
                          )}
                          {f["Link"] && (
                            <a href={f["Link"]} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                        <span>
                          Coach:{" "}
                          {coach ? (
                            <span className={`font-medium ${coachColour(coach).text}`}>{coach}</span>
                          ) : (
                            <span className="text-amber-600 font-medium">Pending</span>
                          )}
                        </span>
                        <span className={`font-medium ${colours.badge.replace("bg-", "text-").replace("-100", "-700")}`}>
                          {isPending
                            ? formatElapsed(f["Created"])
                            : f["Response Time"] ? f["Response Time"]
                            : timeDiff !== undefined ? `${timeDiff}m` : "—"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Monthly Call Calendar ────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="p-5">
          <SectionHeader icon={CalendarDays} title={`Call Calendar · ${monthLabel}`} sub={`${monthlyMeetings.length} calls this month`} />

          {/* Day-of-week header */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {weekDayLabels.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthGrid.map((cell) => {
              const calls = dayMap[cell.iso] ?? [];
              const isToday = cell.iso === today;
              const isExpanded = expandedDay === cell.iso;
              const coaches = [...new Set(calls.map((r) => r.fields["Coach Assigned"] ?? "").filter(Boolean))].slice(0, 3);

              return (
                <div key={cell.iso} className="col-span-1">
                  <button
                    onClick={() => {
                      if (!cell.isCurrentMonth) return;
                      setExpandedDay(isExpanded ? null : cell.iso);
                    }}
                    disabled={!cell.isCurrentMonth}
                    className={`w-full rounded-lg border p-2 text-left transition-all ${
                      !cell.isCurrentMonth
                        ? "border-transparent bg-transparent opacity-30 cursor-default"
                        : isToday
                        ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
                        : isExpanded
                        ? "border-primary/30 bg-muted/60"
                        : calls.length > 0
                        ? "border-border/60 bg-card hover:bg-muted/40 cursor-pointer"
                        : "border-border/30 bg-card/50 hover:bg-muted/20 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold ${isToday ? "text-primary" : !cell.isCurrentMonth ? "text-muted-foreground/40" : "text-foreground"}`}>
                        {cell.day}
                      </span>
                      {isToday && (
                        <span className="text-[8px] font-bold text-primary bg-primary/10 px-1 rounded-full">Today</span>
                      )}
                    </div>

                    {calls.length > 0 && (
                      <>
                        <p className={`text-lg font-bold leading-none mb-1 ${isToday ? "text-primary" : "text-foreground"}`}>
                          {calls.length}
                        </p>
                        <div className="flex flex-wrap gap-0.5">
                          {coaches.map((coach) => (
                            <span
                              key={coach}
                              title={coach}
                              className={`h-3 w-3 rounded-full ${coachColour(coach).dot} flex items-center justify-center text-white text-[6px] font-bold`}
                            >
                              {coach.charAt(0).toUpperCase()}
                            </span>
                          ))}
                          {new Set(calls.map((r) => r.fields["Coach Assigned"] ?? "").filter(Boolean)).size > 3 && (
                            <span className="h-3 w-3 rounded-full bg-muted flex items-center justify-center text-[6px] font-bold text-muted-foreground">
                              +{new Set(calls.map((r) => r.fields["Coach Assigned"] ?? "").filter(Boolean)).size - 3}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Expanded day panel */}
          {expandedDay && dayMap[expandedDay] && (
            <div className="mt-4 rounded-xl border border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border/60">
                <div className="flex items-center gap-2">
                  {expandedDay === today ? (
                    <ChevronDown className="h-4 w-4 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {new Date(expandedDay + "T12:00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                  <span className="text-xs text-muted-foreground">· {dayMap[expandedDay].length} calls</span>
                </div>
                <button
                  onClick={() => setExpandedDay(null)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="divide-y divide-border/50">
                {/* Table header */}
                <div className="grid grid-cols-[80px_1fr_140px_1fr_60px_100px] gap-3 px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-card">
                  <span>Time</span>
                  <span>Member</span>
                  <span>Coach</span>
                  <span>Call Type</span>
                  <span>Dur.</span>
                  <span>Status</span>
                </div>
                {dayMap[expandedDay].map((r) => {
                  const f = r.fields;
                  const coach = f["Coach Assigned"] ?? "";
                  const colour = coachColour(coach);
                  return (
                    <div
                      key={r.id}
                      className="grid grid-cols-[80px_1fr_140px_1fr_60px_100px] gap-3 items-center px-4 py-2.5 hover:bg-muted/20 transition-colors bg-card"
                    >
                      <span className="text-xs font-mono text-muted-foreground">{formatTime(f["Event Start Time (NZT)"])}</span>
                      <span className="text-sm font-medium text-foreground truncate">{f["Invitee Name"] ?? "—"}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${colour.bg} ${colour.text}`}>
                        {coach || "Unassigned"}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">{f["Event type"] ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{f["Call duration"] ? `${f["Call duration"]}m` : "—"}</span>
                      <StatusPill status={f["Meeting Status"]} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {expandedDay && !dayMap[expandedDay] && (
            <div className="mt-4 rounded-xl border border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
              No calls recorded for {new Date(expandedDay + "T12:00:00").toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" })}.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
