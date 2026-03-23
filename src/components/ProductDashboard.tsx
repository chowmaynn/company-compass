import { useCircle } from "@/hooks/use-circle";
import { scorecardData } from "@/data/scorecardData";
import { Card, CardContent } from "@/components/ui/card";
import {
  Users,
  UserPlus,
  MessageSquare,
  CalendarDays,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  AlertCircle,
} from "lucide-react";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-NZ", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" });
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number | null;
  sub?: string;
  color: string;
}) {
  return (
    <Card className="card-shadow">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="text-3xl font-bold text-foreground">
          {value === null ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : value.toLocaleString()}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    green: { label: "On Track", className: "bg-status-green/10 text-status-green" },
    "light-green": { label: "Ahead", className: "bg-status-green/10 text-status-green" },
    yellow: { label: "Behind", className: "bg-status-yellow/10 text-status-yellow" },
    red: { label: "At Risk", className: "bg-status-red/10 text-status-red" },
  };
  const s = map[status] ?? map.red;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.className}`}>
      {s.label}
    </span>
  );
}

export function ProductDashboard() {
  const { totalMembers, newMembersThisMonth, totalPosts, upcomingEvents, recentMembers, isLoading, isError } = useCircle();

  const productMetrics = scorecardData.filter((m) => m.department === "Product");

  const onTrack = productMetrics.filter((m) => m.status === "green" || m.status === "light-green").length;
  const behind = productMetrics.filter((m) => m.status === "yellow").length;
  const atRisk = productMetrics.filter((m) => m.status === "red").length;

  return (
    <div className="space-y-6">

      {/* ── Community Stats ───────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Community — Circle.so</h3>
          {isError && (
            <span className="flex items-center gap-1 text-xs text-status-red">
              <AlertCircle className="h-3 w-3" /> API error
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Total Members"
            value={totalMembers}
            sub="All time"
            color="bg-blue-100 text-blue-600"
          />
          <StatCard
            icon={UserPlus}
            label="New This Month"
            value={newMembersThisMonth}
            sub="March 2026"
            color="bg-emerald-100 text-emerald-600"
          />
          <StatCard
            icon={MessageSquare}
            label="Total Posts"
            value={totalPosts}
            sub="All time"
            color="bg-violet-100 text-violet-600"
          />
          <StatCard
            icon={CalendarDays}
            label="Upcoming Events"
            value={upcomingEvents.length}
            sub="Next 3 shown below"
            color="bg-amber-100 text-amber-600"
          />
        </div>
      </div>

      {/* ── Upcoming Events + Scorecard KPIs ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Upcoming Events */}
        <Card className="card-shadow">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming Events</h3>
            {isLoading ? (
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

        {/* Scorecard KPIs */}
        <Card className="card-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Scorecard KPIs</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-green" /> {onTrack} on track
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-yellow" /> {behind} behind
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-status-red" /> {atRisk} at risk
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {productMetrics.map((m) => {
                const actual = typeof m.monthlyActual === "number" ? m.monthlyActual : m.monthlyActual;
                const target = typeof m.monthlyTarget === "number" ? m.monthlyTarget : m.monthlyTarget;
                return (
                  <div key={m.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">Target: {String(target)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-sm font-semibold text-foreground">{String(actual)}</span>
                      <StatusPill status={m.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent New Members ────────────────────────────── */}
      <Card className="card-shadow">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Recent New Members</h3>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {recentMembers.map((member) => (
                <a
                  key={member.id}
                  href={member.profile_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                    {member.first_name?.[0]}{member.last_name?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{member.first_name} {member.last_name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(member.created_at)}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
