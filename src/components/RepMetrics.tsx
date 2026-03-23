import { useState } from "react";
import { useRepMetrics, REPS, type Rep } from "@/hooks/use-rep-metrics";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const GRID = "hsl(220, 13%, 91%)";
const TICK = "hsl(220, 9%, 46%)";
const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid hsl(220, 13%, 91%)",
  borderRadius: "8px",
  color: "hsl(224, 71%, 4%)",
  fontSize: "12px",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.07)",
};

const REP_ACCENT: Record<string, string> = {
  callum:    "#3b82f6",
  harry:     "#6366f1",
  jamie:     "#8b5cf6",
  joel:      "#10b981",
  kornelius: "#f59e0b",
};

const STAGE_COLORS: Record<string, string> = {
  "Lead In":               "#94a3b8",
  "Call Booked":           "#3b82f6",
  "Call Completed":        "#6366f1",
  "Follow-up In Progress": "#f59e0b",
};

function formatDay(d: string) {
  const dt = new Date(d);
  return `${dt.getDate()}/${dt.getMonth() + 1}`;
}

// ── Stat panel ────────────────────────────────────────────
function StatPanel({ items, loading }: {
  items: { label: string; value: string | number | null; sub?: string; accent?: string }[];
  loading?: boolean;
}) {
  return (
    <div className="grid divide-x divide-border bg-white rounded-2xl border border-border overflow-hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <div key={item.label} className="px-6 py-5">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{item.label}</p>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <p className={`text-3xl font-bold ${item.accent ?? "text-foreground"}`}>
              {item.value ?? "—"}
            </p>
          )}
          {item.sub && <p className="text-xs text-muted-foreground mt-1">{item.sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Rep content ───────────────────────────────────────────
function RepContent({ rep }: { rep: Rep }) {
  const {
    wonCount, lostCount, winRate,
    pipelineCount, pipelineByStage,
    callsTotal, callsAnswered, showRate, avgCallDuration,
    dailyWins, calendlyBooked,
    isLoading,
  } = useRepMetrics(rep);

  const accent = REP_ACCENT[rep.id] ?? "#3b82f6";

  return (
    <div className="space-y-6">

      {/* ── KPI stat panel ─────────────────────────────────── */}
      <StatPanel loading={isLoading} items={[
        { label: "Won",            value: wonCount,  sub: "This month",          accent: wonCount > 0 ? "text-emerald-600" : undefined },
        { label: "Lost",           value: lostCount, sub: "This month" },
        { label: "Win Rate",       value: winRate !== null ? `${winRate}%` : null, sub: "Won ÷ (Won + Lost)" },
        { label: "Pipeline",       value: pipelineCount, sub: "Active deals" },
        { label: "Calls",          value: callsTotal, sub: `${callsAnswered} answered` },
        { label: "Show Rate",      value: showRate !== null ? `${showRate}%` : null, sub: "Answered ÷ total" },
        { label: "Avg Duration",   value: avgCallDuration !== null ? `${avgCallDuration}m` : null, sub: "Answered calls" },
        { label: "Follow-ups",     value: calendlyBooked, sub: "Calendly booked" },
      ]} />

      {/* ── Charts row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Pipeline by stage */}
        <Card className="card-shadow">
          <CardContent className="p-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Pipeline Stages</p>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : pipelineByStage.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No active pipeline</p>
            ) : (
              <div className="space-y-4">
                {pipelineByStage.map((stage, i) => {
                  const max = Math.max(...pipelineByStage.map((s) => s.count));
                  const pct = Math.round((stage.count / max) * 100);
                  const color = STAGE_COLORS[stage.label] ?? "#94a3b8";
                  return (
                    <div key={stage.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: color }}>
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-foreground">{stage.label}</span>
                        </div>
                        <span className="text-sm font-bold text-foreground">{stage.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden ml-7">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily wins */}
        <Card className="card-shadow lg:col-span-2">
          <CardContent className="p-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Won Deals — Daily</p>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : dailyWins.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No wins recorded yet this month</p>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={dailyWins}>
                  <defs>
                    <linearGradient id="repWonGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={accent} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Date: ${v}`} formatter={(v: number) => [v, "Deals won"]} />
                  <Area type="monotone" dataKey="won" stroke={accent} strokeWidth={2.5} fill="url(#repWonGrad)" dot={false} activeDot={{ r: 5, fill: accent }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Call breakdown chart ────────────────────────────── */}
      {!isLoading && callsTotal > 0 && (
        <Card className="card-shadow">
          <CardContent className="p-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Call Breakdown</p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart
                data={[{ name: rep.display, answered: callsAnswered, missed: callsTotal - callsAnswered }]}
                layout="vertical"
                barSize={22}
                margin={{ left: 0, right: 60, top: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "hsl(224, 71%, 4%)", fontWeight: 500 }} axisLine={false} tickLine={false} width={60} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "hsl(220, 20%, 97%)" }} />
                <Bar dataKey="answered" name="Answered" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="missed"   name="Missed"   stackId="a" fill="#f1f5f9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-xs text-muted-foreground">Answered ({callsAnswered})</span></div>
              <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-200" /><span className="text-xs text-muted-foreground">Missed ({callsTotal - callsAnswered})</span></div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

// ── Main export ───────────────────────────────────────────
export function RepMetrics() {
  const [selectedRep, setSelectedRep] = useState<Rep>(REPS[0]);

  return (
    <div className="space-y-6">

      {/* ── Rep selector ───────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {REPS.map((rep) => {
          const active = selectedRep.id === rep.id;
          const accent = REP_ACCENT[rep.id] ?? "#3b82f6";
          return (
            <button
              key={rep.id}
              onClick={() => setSelectedRep(rep)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                active
                  ? "text-white border-transparent shadow-sm"
                  : "bg-white text-muted-foreground border-border hover:text-foreground"
              }`}
              style={active ? { backgroundColor: accent, borderColor: accent } : {}}
            >
              {rep.display}
            </button>
          );
        })}
      </div>

      {/* ── Rep data ───────────────────────────────────────── */}
      <RepContent key={selectedRep.id} rep={selectedRep} />

    </div>
  );
}
