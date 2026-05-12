import { useBookingMetrics } from "@/hooks/use-booking-metrics";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { formatDay } from "@/lib/dates";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";
import { GRID, TICK, TOOLTIP_STYLE } from "@/lib/chart-theme";
const SOURCE_COLORS = ["#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#14b8a6", "#f97316", "#64748b"];

export function BookingsDashboard({ from, to, showRate }: {
  from: string; to: string; showRate: number | null;
}) {
  const {
    totalBookings, totalHeld,
    caseyCancel, inviteeCancel, otherCancel, noShows,
    noShowRate, cancellationRate,
    dailyBookings, salesEventBreakdown,
    isLoading, isError,
  } = useBookingMetrics(from, to);

  if (isError) {
    return (
      <div className="flex items-center gap-2 py-6 text-status-red">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">Failed to load bookings data</span>
      </div>
    );
  }

  // ── Stat panel ─────────────────────────────────────────
  const stats = [
    { label: "Bookings",     value: isLoading ? null : totalBookings, sub: "Public sources",           accent: undefined },
    { label: "Held",         value: isLoading ? null : totalHeld,     sub: "Calls completed",          accent: undefined },
    { label: "Show Rate",    value: showRate !== null ? `${showRate}%` : "—", sub: "Close · answered ÷ total", accent: undefined },
    { label: "No Shows",     value: isLoading ? null : noShows,       sub: noShowRate !== null ? `${noShowRate}% of qualified` : undefined, accent: noShows > 5 ? "text-amber-600" : undefined },
    { label: "Country Disq.", value: isLoading ? null : caseyCancel,  sub: "Host-cancelled",           accent: caseyCancel > 0 ? "text-orange-500" : undefined },
    { label: "Invitee Cancel",value: isLoading ? null : inviteeCancel,sub: cancellationRate !== null ? `${cancellationRate}% of bookings` : undefined, accent: undefined },
  ];

  return (
    <div className="space-y-5">

      {/* ── Stat panel ──────────────────────────────────── */}
      <div className="grid divide-x divide-border bg-card rounded-2xl border border-border overflow-hidden"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
        {stats.map((s) => (
          <div key={s.label} className="px-5 py-5">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{s.label}</p>
            {isLoading && s.label !== "Show Rate" ? (
              <LoadingIndicator />
            ) : (
              <p className={`text-3xl font-bold ${s.accent ?? "text-foreground"}`}>
                {s.value ?? "—"}
              </p>
            )}
            {s.sub && <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Charts ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Daily trend */}
        <Card className="">
          <CardContent className="p-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Daily Trend</p>
            {(() => {
              const activeDays = dailyBookings.filter(d => d.bookings > 0 || d.held > 0 || d.qualified > 0);
              if (isLoading) return <div className="flex items-center justify-center" style={{ height: 200 }}><LoadingIndicator /></div>;
              if (activeDays.length < 2) return <p className="text-xs text-muted-foreground py-8 text-center">Not enough data for trend chart</p>;
              return (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={activeDays}>
                  <defs>
                    {(["#3b82f6", "#6366f1", "#10b981"] as const).map((c, i) => (
                      <linearGradient key={i} id={`bg${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={c} stopOpacity={0.12} />
                        <stop offset="95%" stopColor={c} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fontSize: 11, fill: TICK }} axisLine={{ stroke: GRID }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={false} contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => `Date: ${v}`} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="bookings"  name="Bookings"  stroke="#3b82f6" strokeWidth={2} fill="url(#bg0)" dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="qualified" name="Qualified" stroke="#6366f1" strokeWidth={2} fill="url(#bg1)" dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="held"      name="Held"      stroke="#10b981" strokeWidth={2} fill="url(#bg2)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
              );
            })()}
          </CardContent>
        </Card>

        {/* Qualified by source */}
        <Card className="">
          <CardContent className="p-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Qualified by Source</p>
            {isLoading ? (
              <div className="flex items-center justify-center" style={{ height: 200 }}><LoadingIndicator /></div>
            ) : salesEventBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={salesEventBreakdown} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: TICK }} axisLine={{ stroke: GRID }}
                    tickLine={false} interval={0} angle={-30} textAnchor="end" height={48} />
                  <YAxis tick={{ fontSize: 11, fill: TICK }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={false} contentStyle={TOOLTIP_STYLE} formatter={(v: number) => [v, "Qualified"]} />
                  <Bar dataKey="qualified" radius={[4, 4, 0, 0]}>
                    {salesEventBreakdown.map((_, i) => (
                      <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
