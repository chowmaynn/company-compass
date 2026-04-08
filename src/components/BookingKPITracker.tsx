import React, { useState, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, StickyNote, X } from "lucide-react";

// ─── Note Popover ─────────────────────────────────────────────────────────────

function NotePopover({
  date, value, onChange,
}: {
  date: Date;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const hasNote = value.trim().length > 0;
  const dayLabel = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  // Sync draft when value changes externally
  useEffect(() => { if (!open) setDraft(value); }, [value, open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        onChange(draft);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, draft, onChange]);

  function save() { onChange(draft); setOpen(false); }
  function clear() { setDraft(""); onChange(""); setOpen(false); }

  return (
    <div ref={ref} style={{ position: "relative", display: "flex", justifyContent: "center" }}>
      {/* Trigger button */}
      <button
        onClick={() => { setDraft(value); setOpen(o => !o); }}
        title={hasNote ? value : "Add note"}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer",
          background: hasNote ? "rgba(250,204,21,0.15)" : "rgba(255,255,255,0.05)",
          color: hasNote ? "#facc15" : "rgba(255,255,255,0.25)",
          transition: "all 0.15s",
          position: "relative",
        }}
      >
        <StickyNote size={13} />
        {hasNote && (
          <span style={{
            position: "absolute", top: 3, right: 3,
            width: 5, height: 5, borderRadius: "50%",
            background: "#facc15",
          }} />
        )}
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position: "fixed",
          zIndex: 9999,
          width: 280,
          background: "hsl(var(--card))",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          padding: 0,
          overflow: "hidden",
          // Centered below trigger — we'll use a layout trick
          transform: "translateX(-50%)",
          left: "50%",
          top: 36,
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(250,204,21,0.08)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <StickyNote size={13} color="#facc15" />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#facc15" }}>{dayLabel}</span>
            </div>
            <button onClick={() => { onChange(draft); setOpen(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 2, display: "flex" }}>
              <X size={13} />
            </button>
          </div>

          {/* Textarea */}
          <div style={{ padding: 10 }}>
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && e.metaKey) save(); if (e.key === "Escape") { onChange(draft); setOpen(false); } }}
              rows={6}
              placeholder="What changed today? (e.g. launched new ad, changed CTA, sent email blast...)"
              style={{
                width: "100%", resize: "vertical",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6, outline: "none",
                fontSize: 12, color: "var(--foreground)",
                padding: "8px 10px", lineHeight: 1.6,
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
              onFocus={e => (e.currentTarget.style.borderColor = "hsl(var(--primary))")}
              onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            />
          </div>

          {/* Footer */}
          <div style={{ display: "flex", gap: 6, padding: "0 10px 10px", justifyContent: "flex-end" }}>
            {draft.trim() && (
              <button onClick={clear} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.1)", background: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                Clear
              </button>
            )}
            <button onClick={save} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 5, border: "none", background: "hsl(var(--primary))", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
              Save ⌘↵
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MetricName =
  | "QF Calls Booked"
  | "Skool Joins"
  | "Skool Bookings DM Setter"
  | "Skool Booking %"
  | "Skool Bookings Post"
  | "Skool Bookings Classroom"
  | "Email Bookings"
  | "Welcome Sequence Email Bookings"
  | "Website Visitors (Active Users)"
  | "Website Bookings (Total)"
  | "Website Booking %"
  | "Google Bookings"
  | "Webinar Bookings";

const AUTO_CALC = new Set<MetricName>(["Skool Booking %", "Website Booking %"]);
const PCT_FORMAT = new Set<MetricName>(["Skool Booking %", "Website Booking %"]);

// ─── Layout constants ─────────────────────────────────────────────────────────

const W_METRIC = 220;
const W_TARGET = 72;
const W_AVG    = 72;
const W_DAY    = 50;

const L_METRIC = 0;
const L_TARGET = W_METRIC;
const L_AVG    = W_METRIC + W_TARGET;

// Shared border tokens
const B_ROW      = "1px solid rgba(255,255,255,0.08)";   // horizontal row divider
const B_FROZEN   = "1px solid rgba(255,255,255,0.15)";   // dividers inside frozen panel
const B_PANEL    = "2px solid rgba(255,255,255,0.25)";   // right edge of frozen panel (separator from days)
const B_SECTION  = "1px solid rgba(255,255,255,0.12)";   // between sections

// ─── Sections ─────────────────────────────────────────────────────────────────

interface Section {
  label: string;
  textColor: string;
  accentBorder: string;
  rowTint: string;
  headerTint: string;
  metrics: MetricName[];
}

const SECTIONS: Section[] = [
  {
    label: "QF Calls",
    textColor: "#a78bfa",
    accentBorder: "3px solid rgba(139,92,246,0.8)",
    rowTint: "rgba(139,92,246,0.04)",
    headerTint: "rgba(139,92,246,0.14)",
    metrics: ["QF Calls Booked"],
  },
  {
    label: "Skool",
    textColor: "#fbbf24",
    accentBorder: "3px solid rgba(245,158,11,0.8)",
    rowTint: "rgba(245,158,11,0.04)",
    headerTint: "rgba(245,158,11,0.14)",
    metrics: [
      "Skool Joins",
      "Skool Bookings DM Setter",
      "Skool Booking %",
      "Skool Bookings Post",
      "Skool Bookings Classroom",
    ],
  },
  {
    label: "Email",
    textColor: "#60a5fa",
    accentBorder: "3px solid rgba(59,130,246,0.8)",
    rowTint: "rgba(59,130,246,0.04)",
    headerTint: "rgba(59,130,246,0.14)",
    metrics: ["Email Bookings", "Welcome Sequence Email Bookings"],
  },
  {
    label: "Website",
    textColor: "#f472b6",
    accentBorder: "3px solid rgba(236,72,153,0.8)",
    rowTint: "rgba(236,72,153,0.04)",
    headerTint: "rgba(236,72,153,0.14)",
    metrics: [
      "Website Visitors (Active Users)",
      "Website Bookings (Total)",
      "Website Booking %",
    ],
  },
  {
    label: "Google & Webinar",
    textColor: "#fb923c",
    accentBorder: "3px solid rgba(249,115,22,0.8)",
    rowTint: "rgba(249,115,22,0.04)",
    headerTint: "rgba(249,115,22,0.14)",
    metrics: ["Google Bookings", "Webinar Bookings"],
  },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Storage ──────────────────────────────────────────────────────────────────

interface DayData { note: string; values: Partial<Record<MetricName, string>>; }
interface TrackerState { days: Record<string, DayData>; targets: Partial<Record<MetricName, string>>; }

function storageKey(y: number, m: number) { return `booking-kpi-${y}-${String(m + 1).padStart(2, "0")}`; }
function loadState(y: number, m: number): TrackerState {
  try { const r = localStorage.getItem(storageKey(y, m)); if (r) return JSON.parse(r); } catch {}
  return { days: {}, targets: {} };
}
function saveState(y: number, m: number, s: TrackerState) { localStorage.setItem(storageKey(y, m), JSON.stringify(s)); }
function getDaysInMonth(y: number, m: number): Date[] {
  const out: Date[] = []; const d = new Date(y, m, 1);
  while (d.getMonth() === m) { out.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return out;
}
function toISO(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

// ─── Component ────────────────────────────────────────────────────────────────

export function BookingKPITracker() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [bg, setBg]       = useState("#1a1a1a");
  const [state, setState] = useState<TrackerState>(() => loadState(now.getFullYear(), now.getMonth()));

  const days  = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const today = toISO(now);

  // Resolve actual card background so sticky cells are truly opaque
  useEffect(() => {
    const el = document.createElement("div");
    el.className = "bg-card"; el.style.cssText = "position:absolute;visibility:hidden";
    document.body.appendChild(el);
    const c = getComputedStyle(el).backgroundColor;
    document.body.removeChild(el);
    if (c && c !== "rgba(0, 0, 0, 0)") setBg(c);
  }, []);

  useEffect(() => { setState(loadState(year, month)); }, [year, month]);
  useEffect(() => { saveState(year, month, state); }, [state, year, month]);

  function getDayData(d: Date): DayData { return state.days[toISO(d)] ?? { note: "", values: {} }; }

  function updateNote(d: Date, note: string) {
    setState(p => ({ ...p, days: { ...p.days, [toISO(d)]: { ...getDayData(d), note } } }));
  }
  function updateValue(d: Date, metric: MetricName, value: string) {
    const cur = getDayData(d);
    setState(p => ({ ...p, days: { ...p.days, [toISO(d)]: { ...cur, values: { ...cur.values, [metric]: value } } } }));
  }
  function updateTarget(metric: MetricName, value: string) {
    setState(p => ({ ...p, targets: { ...p.targets, [metric]: value } }));
  }

  function getComputed(d: Date, metric: MetricName): number | null {
    const v = getDayData(d).values;
    if (metric === "Skool Booking %") {
      const s = parseFloat(v["Skool Bookings DM Setter"] ?? ""), j = parseFloat(v["Skool Joins"] ?? "");
      return (!isNaN(s) && !isNaN(j) && j > 0) ? (s / j) * 100 : null;
    }
    if (metric === "Website Booking %") {
      const b = parseFloat(v["Website Bookings (Total)"] ?? ""), vis = parseFloat(v["Website Visitors (Active Users)"] ?? "");
      return (!isNaN(b) && !isNaN(vis) && vis > 0) ? (b / vis) * 100 : null;
    }
    const n = parseFloat(v[metric] ?? ""); return isNaN(n) ? null : n;
  }

  function fmtVal(val: number | null, metric: MetricName): string {
    if (val === null) return "";
    return PCT_FORMAT.has(metric) ? val.toFixed(2) + "%" : (Number.isInteger(val) ? String(val) : val.toFixed(2));
  }

  function cellStyle(val: number | null, metric: MetricName): React.CSSProperties {
    if (val === null) return {};
    const t = parseFloat(state.targets[metric] ?? ""); if (isNaN(t)) return {};
    return val >= t
      ? { background: "rgba(16,185,129,0.2)", color: "#34d399", fontWeight: 600 }
      : { background: "rgba(239,68,68,0.2)",  color: "#f87171", fontWeight: 600 };
  }

  function getAvg(metric: MetricName): string {
    const vals = days.map(d => getComputed(d, metric)).filter((v): v is number => v !== null);
    if (!vals.length) return "—";
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return PCT_FORMAT.has(metric) ? avg.toFixed(2) + "%" : (Number.isInteger(avg) ? String(avg) : avg.toFixed(2));
  }

  function prevMonth() { month === 0 ? (setYear(y => y-1), setMonth(11)) : setMonth(m => m-1); }
  function nextMonth() { month === 11 ? (setYear(y => y+1), setMonth(0)) : setMonth(m => m+1); }

  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // ── Sticky style helpers — all use the resolved solid bg ──────────────────

  const S = {
    metric: (extra: React.CSSProperties = {}): React.CSSProperties => ({
      position: "sticky", left: L_METRIC, zIndex: 10, backgroundColor: bg,
      width: W_METRIC, minWidth: W_METRIC,
      borderRight: B_FROZEN, borderBottom: B_ROW, ...extra,
    }),
    target: (extra: React.CSSProperties = {}): React.CSSProperties => ({
      position: "sticky", left: L_TARGET, zIndex: 10, backgroundColor: bg,
      width: W_TARGET, minWidth: W_TARGET,
      borderRight: B_FROZEN, borderBottom: B_ROW, ...extra,
    }),
    avg: (extra: React.CSSProperties = {}): React.CSSProperties => ({
      position: "sticky", left: L_AVG, zIndex: 10, backgroundColor: bg,
      width: W_AVG, minWidth: W_AVG,
      borderRight: B_PANEL, borderBottom: B_ROW,
      boxShadow: "4px 0 10px rgba(0,0,0,0.35)", ...extra,
    }),
  };

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors">
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-sm font-semibold text-foreground min-w-[150px] text-center">{monthLabel}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Table — border-separate is REQUIRED for sticky + visible borders */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: 13 }}>

          <thead>
            <tr>
              <th style={{ ...S.metric({ borderBottom: B_FROZEN }), padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Metric
              </th>
              <th style={{ ...S.target({ borderBottom: B_FROZEN }), padding: "10px 8px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "hsl(var(--primary))", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Target
              </th>
              <th style={{ ...S.avg({ borderBottom: B_FROZEN }), padding: "10px 8px", textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Avg/Day
              </th>
              {days.map(d => {
                const iso = toISO(d), isToday = iso === today;
                return (
                  <th key={iso} style={{ width: W_DAY, minWidth: W_DAY, borderRight: B_ROW, borderBottom: B_FROZEN, padding: "6px 4px", textAlign: "center", backgroundColor: isToday ? "rgba(99,102,241,0.15)" : undefined }}>
                    <div style={{ fontSize: 9, color: "var(--muted-foreground)" }}>{DAY_NAMES[d.getDay()]}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? "hsl(var(--primary))" : "var(--foreground)" }}>{d.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {/* Notes row */}
            <tr>
              <td style={{ ...S.metric({ borderBottom: B_SECTION }), padding: "8px 16px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>
                Notes / Changes
              </td>
              <td style={{ ...S.target({ borderBottom: B_SECTION }) }} />
              <td style={{ ...S.avg({ borderBottom: B_SECTION }) }} />
              {days.map(d => {
                const iso = toISO(d);
                return (
                  <td key={iso} style={{ width: W_DAY, minWidth: W_DAY, borderRight: B_ROW, borderBottom: B_SECTION, padding: "4px 2px", textAlign: "center", verticalAlign: "middle", backgroundColor: iso === today ? "rgba(99,102,241,0.08)" : undefined }}>
                    <NotePopover
                      date={d}
                      value={getDayData(d).note}
                      onChange={note => updateNote(d, note)}
                    />
                  </td>
                );
              })}
            </tr>

            {/* Sections */}
            {SECTIONS.map((section, si) => (
              <React.Fragment key={section.label}>

                {/* Section header row */}
                <tr>
                  <td style={{
                    ...S.metric({ borderLeft: section.accentBorder, borderBottom: B_SECTION, borderTop: si === 0 ? "none" : B_SECTION }),
                    padding: "6px 14px",
                    backgroundColor: section.headerTint,
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
                    color: section.textColor,
                  }}>
                    {section.label}
                  </td>
                  <td style={{ ...S.target({ borderBottom: B_SECTION, borderTop: si === 0 ? "none" : B_SECTION, backgroundColor: section.headerTint }) }} />
                  <td style={{ ...S.avg({ borderBottom: B_SECTION, borderTop: si === 0 ? "none" : B_SECTION, backgroundColor: section.headerTint }) }} />
                  {days.map(d => (
                    <td key={toISO(d)} style={{ width: W_DAY, minWidth: W_DAY, borderRight: B_ROW, borderBottom: B_SECTION, backgroundColor: section.headerTint }} />
                  ))}
                </tr>

                {/* Metric rows */}
                {section.metrics.map((metric, mi) => {
                  const isAuto = AUTO_CALC.has(metric);
                  const isLastRow = mi === section.metrics.length - 1;
                  const rowBorderBottom = isLastRow ? B_SECTION : B_ROW;

                  return (
                    <tr key={metric}>
                      {/* Metric name */}
                      <td style={{
                        ...S.metric({ borderLeft: section.accentBorder, borderBottom: rowBorderBottom }),
                        padding: "8px 14px",
                        fontSize: 13, fontWeight: 500, color: "var(--foreground)", whiteSpace: "nowrap",
                      }}>
                        {metric}
                        {isAuto && <span style={{ marginLeft: 6, fontSize: 9, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>auto</span>}
                      </td>

                      {/* Target */}
                      <td style={{ ...S.target({ borderBottom: rowBorderBottom }), padding: 4 }}>
                        <input
                          type="text" inputMode="decimal"
                          value={state.targets[metric] ?? ""}
                          onChange={e => updateTarget(metric, e.target.value)}
                          style={{ width: "100%", background: "transparent", border: "1px solid transparent", borderRadius: 4, textAlign: "center", fontSize: 12, fontFamily: "monospace", color: "hsl(var(--primary))", fontWeight: 600, padding: "4px 4px", outline: "none" }}
                          placeholder="—"
                          onFocus={e => (e.currentTarget.style.borderColor = "hsl(var(--primary))")}
                          onBlur={e => (e.currentTarget.style.borderColor = "transparent")}
                        />
                      </td>

                      {/* Avg */}
                      <td style={{ ...S.avg({ borderBottom: rowBorderBottom }), padding: "8px", textAlign: "center", fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: "var(--foreground)" }}>
                        {getAvg(metric)}
                      </td>

                      {/* Day cells */}
                      {days.map(d => {
                        const iso     = toISO(d);
                        const isToday = iso === today;
                        const computed = getComputed(d, metric);
                        const cs       = cellStyle(computed, metric);
                        const todayBg  = "rgba(99,102,241,0.1)";

                        if (isAuto) {
                          return (
                            <td key={iso} style={{ width: W_DAY, minWidth: W_DAY, borderRight: B_ROW, borderBottom: rowBorderBottom, padding: 2, backgroundColor: isToday ? todayBg : section.rowTint }}>
                              <span style={{ display: "block", borderRadius: 4, padding: "4px 2px", textAlign: "center", fontSize: 11, fontFamily: "monospace", color: computed !== null ? undefined : "rgba(255,255,255,0.15)", ...cs }}>
                                {fmtVal(computed, metric)}
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={iso} style={{ width: W_DAY, minWidth: W_DAY, borderRight: B_ROW, borderBottom: rowBorderBottom, padding: 2, backgroundColor: isToday ? todayBg : section.rowTint }}>
                            <input
                              type="text" inputMode="decimal"
                              value={getDayData(d).values[metric] ?? ""}
                              onChange={e => updateValue(d, metric, e.target.value)}
                              style={{ width: "100%", background: "transparent", border: "1px solid transparent", borderRadius: 4, textAlign: "center", fontSize: 11, fontFamily: "monospace", padding: "4px 2px", outline: "none", ...cs }}
                              placeholder=""
                              onFocus={e => (e.currentTarget.style.borderColor = "hsl(var(--primary))")}
                              onBlur={e => { if (!cs.color) e.currentTarget.style.borderColor = "transparent"; }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
        Data saved locally · Today highlighted · Green = on/above target · Red = below target · "auto" rows calculate automatically
      </p>
    </div>
  );
}
