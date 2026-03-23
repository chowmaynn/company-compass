import { useState } from "react";
import { useClose } from "@/hooks/use-close";
import { BookingsDashboard } from "@/components/BookingsDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2, CalendarDays } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
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

// ── Date helpers ─────────────────────────────────────────
type Preset = "month" | "30d" | "60d" | "custom";

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetDates(preset: Preset) {
  const today = new Date();
  const to = fmt(today);
  if (preset === "month") {
    return { from: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`, to };
  }
  const from = new Date(today);
  from.setDate(today.getDate() - (preset === "30d" ? 30 : 60));
  return { from: fmt(from), to };
}

// ── Sub-components ────────────────────────────────────────

/** Horizontal divided stat panel — replaces the card-per-metric grid */
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

function SectionLabel({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
    </div>
  );
}

function DateFilter({ preset, from, to, onPreset, onFrom, onTo }: {
  preset: Preset; from: string; to: string;
  onPreset: (p: Preset) => void; onFrom: (v: string) => void; onTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CalendarDays className="h-4 w-4 text-muted-foreground" />
      <div className="flex items-center gap-0.5 bg-muted rounded-lg p-1">
        {(["month", "30d", "60d", "custom"] as Preset[]).map((p) => (
          <button key={p} onClick={() => onPreset(p)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              preset === p ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            {p === "month" ? "This Month" : p === "30d" ? "Last 30d" : p === "60d" ? "Last 60d" : "Custom"}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => onFrom(e.target.value)}
            className="text-xs border border-border rounded-lg px-3 py-1.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
          <span className="text-xs text-muted-foreground">→</span>
          <input type="date" value={to} onChange={(e) => onTo(e.target.value)}
            className="text-xs border border-border rounded-lg px-3 py-1.5 bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export function SalesDashboard() {
  const {
    wonCount, lostCount, winRate,
    callsTotal, callsAnswered, showRate,
    dailyWins, pipelineStages,
    isLoading, isError,
  } = useClose();

  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState(() => presetDates("month").from);
  const [customTo,   setCustomTo]   = useState(() => presetDates("month").to);

  const { from, to } = preset === "custom"
    ? { from: customFrom, to: customTo }
    : presetDates(preset);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") { const d = presetDates(p); setCustomFrom(d.from); setCustomTo(d.to); }
  };

  if (isError) {
    return (
      <div className="flex items-center gap-2 py-16 text-status-red">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">Failed to load Close.com data</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── 1. Close.com KPIs ─────────────────────────────── */}
      <div>
        <SectionLabel dot="bg-emerald-500 animate-pulse" label="Close.com · This Month" />
        <StatPanel loading={isLoading} items={[
          { label: "Won",           value: wonCount,      sub: "Deals closed",            accent: wonCount > 0 ? "text-emerald-600" : undefined },
          { label: "Lost",          value: lostCount,     sub: "No-show + closed lost" },
          { label: "Win Rate",      value: winRate !== null ? `${winRate}%` : null, sub: "Won ÷ (Won + Lost)" },
          { label: "Calls Answered",value: callsAnswered, sub: `of ${callsTotal} logged` },
          { label: "Show Rate",     value: showRate !== null ? `${showRate}%` : null, sub: "Answered ÷ total calls" },
        ]} />
      </div>

      {/* ── 2. Pipeline + Daily Wins ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Pipeline */}
        <Card className="card-shadow">
          <CardContent className="p-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Active Pipeline</p>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-4">
                {pipelineStages.map((stage, i) => {
                  const max = Math.max(...pipelineStages.map((s) => s.count));
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

        {/* Daily Wins */}
        <Card className="card-shadow lg:col-span-2">
          <CardContent className="p-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Won Deals — Daily</p>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <AreaChart data={dailyWins}>
                  <defs>
                    <linearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Date: ${v}`} formatter={(v: number) => [v, "Deals won"]} />
                  <Area type="monotone" dataKey="won" stroke="#10b981" strokeWidth={2.5} fill="url(#wonGrad)" dot={false} activeDot={{ r: 5, fill: "#10b981" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── 3. Bookings ───────────────────────────────────── */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <SectionLabel dot="bg-indigo-500 animate-pulse" label="Bookings" />
          <DateFilter preset={preset} from={from} to={to}
            onPreset={handlePreset} onFrom={setCustomFrom} onTo={setCustomTo} />
        </div>
        <BookingsDashboard from={from} to={to} showRate={showRate} />
      </div>

    </div>
  );
}
