import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EditableCell } from "@/components/EditableCell";
import { useAuth } from "@/hooks/use-auth";
import type { WeeklyRepData, WeekMetrics } from "@/hooks/use-sales-tracking";
import type { SalesMetricField, SalesTrackingRow } from "@/lib/supabase-sales";
import { formatValue, fmtCurrency } from "@/lib/formatNumber";

const METRIC_ROWS: { label: string; field: SalesMetricField | "show_rate" | "close_rate"; computed?: boolean; currency?: boolean }[] = [
  { label: "Calls Booked", field: "calls_booked" },
  { label: "Show Rate", field: "show_rate", computed: true },
  { label: "Calls Taken", field: "calls_taken" },
  { label: "Close Rate", field: "close_rate", computed: true },
  { label: "Closes", field: "closes" },
  { label: "CC", field: "cc", currency: true },
];

const WEEK_LABELS = ["W1", "W2", "W3", "W4"];

function formatMetricValue(value: number | null, opts: { computed?: boolean; currency?: boolean }): string {
  if (value === null) return "—";
  if (opts.computed) return `${value}%`;
  if (opts.currency) return fmtCurrency(value);
  return formatValue(value);
}

function getMetricValue(metrics: WeekMetrics, field: string): number | null {
  return (metrics as Record<string, number | null>)[field] ?? null;
}

// Monthly format: "2026-03" → "March 2026"
function formatMonth(m: string): string {
  const [y, mo] = m.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[parseInt(mo) - 1]} ${y}`;
}

interface SalesTrackingTableProps {
  month: string;
  setMonth: (m: string) => void;
  reps: WeeklyRepData[];
  teamTotals: WeeklyRepData;
  isLoading: boolean;
  availableMonths: string[];
  updateCell: (repName: string, date: string, field: SalesMetricField, value: number) => Promise<boolean>;
  upsertTodayCell: (repName: string, field: SalesMetricField, value: number) => Promise<boolean>;
  isTodayInMonth: boolean;
  getTodayRow: (repName: string) => any;
  todayDate: string;
}

export function SalesTrackingTable({
  month, setMonth, reps, teamTotals, isLoading, availableMonths,
  updateCell, upsertTodayCell, isTodayInMonth, getTodayRow, todayDate,
}: SalesTrackingTableProps) {
  const { canEdit } = useAuth();
  const editable = canEdit("Sales");

  const [expandedReps, setExpandedReps] = useState<Set<string>>(new Set());

  const toggleRep = (name: string) => {
    setExpandedReps((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  // Get daily data for a rep grouped by week
  const getDailyByWeek = (rep: WeeklyRepData, weekIdx: number) => {
    return rep.dailyRows.filter((r) => {
      const day = parseInt(r.date.split("-")[2]);
      if (weekIdx === 0) return day >= 1 && day <= 7;
      if (weekIdx === 1) return day >= 8 && day <= 14;
      if (weekIdx === 2) return day >= 15 && day <= 21;
      return day >= 22;
    }).sort((a, b) => a.date.localeCompare(b.date));
  };

  const months = useMemo(() => {
    if (availableMonths.length > 0) return availableMonths;
    return [month];
  }, [availableMonths, month]);

  return (
    <Card>
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Sales Tracking</h2>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5 text-foreground"
          >
            {months.map((m) => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : reps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No data for {formatMonth(month)}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground py-2 px-3 w-40 sticky left-0 bg-card z-10">Rep</th>
                  <th className="text-left text-xs font-medium text-muted-foreground py-2 px-2 w-28">Metric</th>
                  {isTodayInMonth && (
                    <th className="text-right text-xs font-semibold text-primary py-2 px-3 w-24 bg-primary/5">Today</th>
                  )}
                  {WEEK_LABELS.map((w) => (
                    <th key={w} className="text-right text-xs font-medium text-muted-foreground py-2 px-3 w-20">{w}</th>
                  ))}
                  <th className="text-right text-xs font-semibold text-foreground py-2 px-3 w-24">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {/* Per-rep rows */}
                {reps.map((rep) => (
                  <RepBlock
                    key={rep.rep_name}
                    rep={rep}
                    editable={editable}
                    expanded={expandedReps.has(rep.rep_name)}
                    onToggle={() => toggleRep(rep.rep_name)}
                    onUpdateCell={updateCell}
                    onUpsertToday={upsertTodayCell}
                    todayRow={getTodayRow(rep.rep_name)}
                    isTodayInMonth={isTodayInMonth}
                    getDailyByWeek={getDailyByWeek}
                    month={month}
                  />
                ))}

                {/* Team totals */}
                <tr className="border-t-2 border-border">
                  <td colSpan={isTodayInMonth ? 8 : 7} className="py-1" />
                </tr>
                {METRIC_ROWS.map((metric) => (
                  <tr key={`team-${metric.field}`} className="bg-muted/20">
                    {metric.field === "calls_booked" ? (
                      <td className="text-xs font-semibold text-foreground py-1.5 px-3 sticky left-0 bg-muted/20 z-10" rowSpan={METRIC_ROWS.length}>
                        TEAM
                      </td>
                    ) : null}
                    <td className={`text-xs py-1.5 px-2 ${metric.computed ? "text-muted-foreground italic" : "text-foreground"}`}>
                      {metric.label}
                    </td>
                    {isTodayInMonth && (
                      <td className="text-right text-xs py-1.5 px-3 tabular-nums bg-primary/5 font-medium">—</td>
                    )}
                    {teamTotals.weeks.map((w, wi) => (
                      <td key={wi} className={`text-right text-xs py-1.5 px-3 tabular-nums ${metric.computed ? "text-muted-foreground italic" : "font-medium"}`}>
                        {formatMetricValue(getMetricValue(w, metric.field), metric)}
                      </td>
                    ))}
                    <td className={`text-right text-xs py-1.5 px-3 tabular-nums font-semibold ${metric.computed ? "text-muted-foreground italic" : ""}`}>
                      {formatMetricValue(getMetricValue(teamTotals.monthly, metric.field), metric)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- RepBlock sub-component ---

interface RepBlockProps {
  rep: WeeklyRepData;
  editable: boolean;
  expanded: boolean;
  onToggle: () => void;
  onUpdateCell: (repName: string, date: string, field: SalesMetricField, value: number) => void;
  onUpsertToday: (repName: string, field: SalesMetricField, value: number) => void;
  todayRow: SalesTrackingRow | null;
  isTodayInMonth: boolean;
  getDailyByWeek: (rep: WeeklyRepData, weekIdx: number) => any[];
  month: string;
}

function RepBlock({ rep, editable, expanded, onToggle, onUpdateCell, onUpsertToday, todayRow, isTodayInMonth, getDailyByWeek, month }: RepBlockProps) {
  return (
    <>
      {METRIC_ROWS.map((metric, mi) => (
        <tr key={`${rep.rep_name}-${metric.field}`} className={mi === 0 ? "border-t border-border" : ""}>
          {mi === 0 ? (
            <td className="text-xs font-medium text-foreground py-1.5 px-3 sticky left-0 bg-card z-10" rowSpan={METRIC_ROWS.length}>
              <button
                onClick={onToggle}
                className="flex items-center gap-1 hover:text-primary transition-colors"
              >
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {rep.rep_name}
              </button>
            </td>
          ) : null}
          <td className={`text-xs py-1.5 px-2 ${metric.computed ? "text-muted-foreground italic" : "text-foreground"}`}>
            {metric.label}
          </td>
          {/* Today column */}
          {isTodayInMonth && (
            <td className="text-right text-xs py-1 px-1 tabular-nums bg-primary/5">
              {metric.computed ? (
                <span className="text-muted-foreground italic">
                  {metric.field === "show_rate" && todayRow
                    ? (todayRow.calls_booked > 0 ? `${Math.round((todayRow.calls_taken / todayRow.calls_booked) * 100)}%` : "—")
                    : metric.field === "close_rate" && todayRow
                    ? (todayRow.calls_taken > 0 ? `${Math.round((todayRow.closes / todayRow.calls_taken) * 100)}%` : "—")
                    : "—"}
                </span>
              ) : editable ? (
                <EditableCell
                  value={todayRow ? todayRow[metric.field as SalesMetricField] : 0}
                  onChange={(v) => onUpsertToday(rep.rep_name, metric.field as SalesMetricField, typeof v === "number" ? v : parseInt(String(v)) || 0)}
                />
              ) : (
                <span>{todayRow ? formatMetricValue(todayRow[metric.field as SalesMetricField], metric) : "0"}</span>
              )}
            </td>
          )}
          {rep.weeks.map((w, wi) => {
            const val = getMetricValue(w, metric.field);

            return (
              <td key={wi} className={`text-right text-xs py-1 px-1 tabular-nums ${metric.computed ? "text-muted-foreground italic" : ""} ${wi % 2 === 0 ? "bg-muted/5" : ""}`}>
                <span>{formatMetricValue(val, metric)}</span>
              </td>
            );
          })}
          <td className={`text-right text-xs py-1.5 px-3 tabular-nums font-semibold ${metric.computed ? "text-muted-foreground italic" : ""}`}>
            {formatMetricValue(getMetricValue(rep.monthly, metric.field), metric)}
          </td>
        </tr>
      ))}

      {/* Expanded daily rows */}
      {expanded && (
        <tr>
          <td colSpan={7} className="p-0">
            <div className="bg-muted/10 border-t border-b border-border/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Daily breakdown — {rep.rep_name}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] text-muted-foreground py-1 px-1 w-20">Date</th>
                      <th className="text-right text-[10px] text-muted-foreground py-1 px-1">Booked</th>
                      <th className="text-right text-[10px] text-muted-foreground py-1 px-1">Taken</th>
                      <th className="text-right text-[10px] text-muted-foreground py-1 px-1">Closes</th>
                      <th className="text-right text-[10px] text-muted-foreground py-1 px-1">CC</th>
                      <th className="text-right text-[10px] text-muted-foreground py-1 px-1">No-Show</th>
                      <th className="text-right text-[10px] text-muted-foreground py-1 px-1">Cancel</th>
                      <th className="text-right text-[10px] text-muted-foreground py-1 px-1">Resched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rep.dailyRows
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .map((row) => {
                        const dayLabel = new Date(row.date + "T12:00:00").toLocaleDateString("en-NZ", {
                          weekday: "short",
                          day: "numeric",
                        });
                        return (
                          <tr key={row.date} className="border-t border-border/30">
                            <td className="text-[10px] text-muted-foreground py-0.5 px-1">{dayLabel}</td>
                            {(["calls_booked", "calls_taken", "closes", "cc", "no_shows", "cancellations", "reschedules"] as SalesMetricField[]).map((field) => (
                              <td key={field} className="text-right py-0.5 px-1">
                                {editable ? (
                                  <EditableCell
                                    value={row[field]}
                                    onChange={(v) => onUpdateCell(rep.rep_name, row.date, field, typeof v === "number" ? v : parseInt(String(v)) || 0)}
                                  />
                                ) : (
                                  <span className="text-xs tabular-nums">
                                    {field === "cc" ? fmtCurrency(row[field]) : row[field]}
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
