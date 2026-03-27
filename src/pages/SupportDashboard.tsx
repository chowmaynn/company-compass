import { useMemo, useState } from "react";
import { useIntercom } from "@/hooks/use-intercom";
import { Card, CardContent } from "@/components/ui/card";
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
  Cell,
} from "recharts";
import {
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Inbox,
  ExternalLink,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────

function stripHtml(html?: string): string {
  if (!html) return "—";
  return html.replace(/<[^>]*>/g, "").trim() || "—";
}

function elapsed(ts: number): string {
  const secs = Math.floor(Date.now() / 1000) - ts;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

function fmtDuration(secs: number): string {
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function dayKey(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${d}/${m}`;
}

const GRID = "hsl(220, 13%, 91%)";
const TICK = "hsl(220, 9%, 46%)";
const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
};

const DAY_PRESETS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
];

// ── Stat card ─────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, accent, bg,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: string; bg?: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`text-3xl font-bold tracking-tight ${accent ?? "text-foreground"}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ml-3 ${bg ?? "bg-muted"}`}>
            <Icon className={`h-5 w-5 ${accent ?? "text-muted-foreground"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function SupportDashboard() {
  const [days, setDays] = useState(30);
  const { recent, inbox, inboxTotal, loading, error } = useIntercom(days);

  // ── Derived stats ─────────────────────────────────────────

  const closedRecent = useMemo(() => recent.filter((c) => c.state === "closed").length, [recent]);
  const openRecent = useMemo(() => recent.filter((c) => c.state === "open").length, [recent]);

  const awaitingReply = useMemo(
    () => inbox.filter((c) => c.waiting_since !== null).length,
    [inbox]
  );

  const avgResponseTime = useMemo(() => {
    const times = recent
      .map((c) => c.statistics?.time_to_admin_reply)
      .filter((t): t is number => typeof t === "number" && t > 0);
    if (!times.length) return null;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }, [recent]);

  const resolutionRate = useMemo(() => {
    if (!recent.length) return null;
    return Math.round((closedRecent / recent.length) * 100);
  }, [recent, closedRecent]);

  // Daily volume — fill all days in range
  const dailyVolume = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      map[key] = 0;
    }
    recent.forEach((c) => {
      const key = dayKey(c.created_at);
      if (key in map) map[key]++;
    });
    return Object.entries(map).map(([key, count]) => ({ key, label: dayLabel(key), count }));
  }, [recent, days]);

  // Response time distribution
  const responseDistribution = useMemo(() => {
    const buckets = [
      { label: "< 1h", max: 3600, colour: "#10b981" },
      { label: "1–4h", max: 14400, colour: "#6366f1" },
      { label: "4–12h", max: 43200, colour: "#f59e0b" },
      { label: "12–24h", max: 86400, colour: "#f97316" },
      { label: "> 24h", max: Infinity, colour: "#f43f5e" },
    ];

    const times = recent
      .map((c) => c.statistics?.time_to_admin_reply)
      .filter((t): t is number => typeof t === "number" && t > 0);

    let prev = 0;
    return buckets.map((b) => {
      const count = times.filter((t) => t > prev && t <= b.max).length;
      prev = b.max;
      return { ...b, count };
    });
  }, [recent]);

  // Inbox — sorted longest wait first
  const sortedInbox = useMemo(() =>
    [...inbox]
      .sort((a, b) => {
        const aWaiting = a.waiting_since ?? 0;
        const bWaiting = b.waiting_since ?? 0;
        if (aWaiting && !bWaiting) return -1;
        if (!aWaiting && bWaiting) return 1;
        return aWaiting - bWaiting;
      })
      .slice(0, 50),
    [inbox]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-sm">Loading Intercom data…</span>
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

  return (
    <div className="space-y-5">

      {/* ── Date range selector ─────────────────────────────── */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {DAY_PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              days === p.days
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Stats row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`Total (${days}d)`}
          value={recent.length}
          sub={`${closedRecent} resolved · ${openRecent} open`}
          icon={MessageSquare}
          accent="text-indigo-600"
          bg="bg-indigo-50 dark:bg-indigo-950/40"
        />
        <StatCard
          label="Your Inbox"
          value={inboxTotal}
          sub="Open & assigned to you"
          icon={Inbox}
          accent="text-blue-600"
          bg="bg-blue-50 dark:bg-blue-950/40"
        />
        <StatCard
          label="Awaiting Reply"
          value={awaitingReply}
          sub="Customer replied last"
          icon={AlertCircle}
          accent={awaitingReply > 20 ? "text-red-600" : awaitingReply > 10 ? "text-amber-600" : "text-emerald-600"}
          bg={awaitingReply > 20 ? "bg-red-50 dark:bg-red-950/40" : awaitingReply > 10 ? "bg-amber-50 dark:bg-amber-950/40" : "bg-emerald-50 dark:bg-emerald-950/40"}
        />
        <StatCard
          label="Avg First Response"
          value={avgResponseTime !== null ? fmtDuration(avgResponseTime) : "—"}
          sub={resolutionRate !== null ? `${resolutionRate}% resolved (${days}d)` : `${days}d window`}
          icon={Clock}
          accent={
            avgResponseTime === null ? "text-foreground"
            : avgResponseTime < 3600 ? "text-emerald-600"
            : avgResponseTime < 14400 ? "text-indigo-600"
            : avgResponseTime < 43200 ? "text-amber-600"
            : "text-red-600"
          }
          bg="bg-muted"
        />
      </div>

      {/* ── Volume trend ───────────────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Conversation Volume</h3>
              <p className="text-xs text-muted-foreground mt-0.5">New conversations per day — last {days} days</p>
            </div>
            <span className="text-xs font-mono text-indigo-600 font-semibold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 rounded-lg">
              {recent.length} total
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyVolume} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} interval={Math.max(1, Math.floor(days / 10))} />
              <YAxis tick={{ fontSize: 10, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, "Conversations"]} />
              <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#volGrad)" dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ── Response distribution + Resolution ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Response time distribution */}
        <Card className="border-border/50">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-0.5">Response Time Distribution</h3>
            <p className="text-xs text-muted-foreground mb-4">First response time across resolved conversations</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={responseDistribution} barSize={36} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, "Conversations"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {responseDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.colour} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resolution rate + open/closed breakdown */}
        <Card className="border-border/50">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-0.5">Resolution Overview</h3>
            <p className="text-xs text-muted-foreground mb-5">Last {days} days · {recent.length} total conversations</p>

            <div className="space-y-5">
              {/* Resolution rate */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Resolution Rate
                  </span>
                  <span className={`text-sm font-bold ${
                    (resolutionRate ?? 0) >= 70 ? "text-emerald-600"
                    : (resolutionRate ?? 0) >= 50 ? "text-amber-600"
                    : "text-red-600"
                  }`}>
                    {resolutionRate ?? "—"}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (resolutionRate ?? 0) >= 70 ? "bg-emerald-500"
                      : (resolutionRate ?? 0) >= 50 ? "bg-amber-500"
                      : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(resolutionRate ?? 0, 100)}%` }}
                  />
                </div>
              </div>

              {/* Open vs closed */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{closedRecent}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Resolved</p>
                </div>
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-center">
                  <p className="text-2xl font-bold text-red-500">{inboxTotal}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Still Open</p>
                </div>
              </div>

              {/* Awaiting reply breakdown */}
              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Awaiting your reply (of inbox)</span>
                  <span className={`text-xs font-bold ${awaitingReply > 20 ? "text-red-600" : "text-amber-600"}`}>
                    {awaitingReply} conversations
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${inboxTotal > 0 ? Math.min((awaitingReply / inboxTotal) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Your Inbox ─────────────────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Your Inbox</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {inboxTotal} open conversations assigned to you · sorted by longest wait first
              </p>
            </div>
            <a
              href="https://app.intercom.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
            >
              Open Intercom <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {sortedInbox.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30 text-emerald-500" />
              <p className="text-sm">Inbox clear — no open conversations assigned to you</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {/* Header */}
              <div className="grid grid-cols-[1fr_140px_100px_90px] gap-3 pb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Contact & Subject</span>
                <span>Source</span>
                <span>Open For</span>
                <span>Status</span>
              </div>

              {sortedInbox.map((c) => {
                const name = c.source?.author?.name ?? "Unknown";
                const subject = stripHtml(c.source?.subject);
                const isWaiting = c.waiting_since !== null;
                const openDuration = elapsed(c.created_at);
                const waitDuration = c.waiting_since ? elapsed(c.waiting_since) : null;

                return (
                  <div
                    key={c.id}
                    className="grid grid-cols-[1fr_140px_100px_90px] gap-3 items-center py-2.5 hover:bg-muted/20 transition-colors rounded"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{subject}</p>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">{c.source?.type ?? "—"}</span>
                    <span className="text-xs font-mono text-muted-foreground">{openDuration}</span>
                    <div>
                      {isWaiting ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                          {waitDuration} wait
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
                          Replied
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {inboxTotal > 50 && (
                <div className="pt-3 text-center">
                  <p className="text-xs text-muted-foreground">
                    Showing 50 of {inboxTotal} conversations.{" "}
                    <a href="https://app.intercom.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      View all in Intercom →
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
