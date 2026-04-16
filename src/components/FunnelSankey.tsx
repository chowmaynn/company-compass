import { useMemo, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import type { Metric, StatusColor } from "@/data/scorecardData";

// ── Types ────────────────────────────────────────────────────

interface Props {
  metrics: Metric[];
  formatCurrency?: (val: number | string | undefined) => string;
  /** Number of days in the selected range — used to pro-rate monthly scorecard targets */
  rangeDays?: number;
  /** Live overrides for distribution / nurturing cards (Kit, GA4, Skool, liam_videos) */
  youtubeVideosValue?: number | null;
  emailBroadcastsValue?: number | null;
  skoolJoinsValue?: number | null;
  websiteViewsValue?: number | null;
  webinarJoinsValue?: number | null;
  /** Per-card loading flags — when true, the card renders a spinner */
  youtubeVideosLoading?: boolean;
  emailBroadcastsLoading?: boolean;
  skoolJoinsLoading?: boolean;
  websiteViewsLoading?: boolean;
  webinarJoinsLoading?: boolean;
  /** Optional speedometer gauges that replace the corresponding funnel cards */
  bookingsGauge?: ReactNode;
  showRateGauge?: ReactNode;
  closeRateGauge?: ReactNode;
  cashGauge?: ReactNode;
}

interface Stage {
  id: string;
  label: string;
  value: number | null;
  target: number | null;
  formatted: string;
  targetFormatted: string;
  status: StatusColor;
  isPlaceholder?: boolean;
  isLoading?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────

function parseNum(val: number | string): number | null {
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/,/g, "").replace(/\$/g, "").trim();
  if (cleaned === "—" || cleaned === "") return null;
  if (cleaned.endsWith("%")) return parseFloat(cleaned) || null;
  if (cleaned.endsWith("k")) { const n = parseFloat(cleaned); return isNaN(n) ? null : n * 1000; }
  if (cleaned.endsWith("m")) { const n = parseFloat(cleaned); return isNaN(n) ? null : n * 1000000; }
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
}

function pctLabel(from: number | null, to: number | null): string | null {
  if (!from || !to || from === 0) return null;
  const pct = (to / from) * 100;
  return pct >= 1 ? `${pct.toFixed(1)}%` : `${pct.toFixed(2)}%`;
}

function statusDot(status: StatusColor): string {
  if (status === "green" || status === "light-green") return "bg-status-green";
  if (status === "yellow") return "bg-status-yellow";
  return "bg-status-red";
}

function statusRing(status: StatusColor): string {
  if (status === "green" || status === "light-green") return "ring-status-green/30";
  if (status === "yellow") return "ring-status-yellow/30";
  return "ring-status-red/30";
}

function metricValue(m: Metric | undefined): number | null {
  if (!m) return null;
  const monthly = parseNum(m.monthlyActual);
  if (monthly != null) return monthly;
  let sum = 0; let hasAny = false;
  for (const w of m.weeks) {
    const v = parseNum(w.actual);
    if (v != null) { sum += v; hasAny = true; }
  }
  return hasAny ? sum : null;
}

function metricTarget(m: Metric | undefined): number | null {
  if (!m) return null;
  const monthly = parseNum(m.monthlyTarget);
  if (monthly != null) return monthly;
  let sum = 0; let hasAny = false;
  for (const w of m.weeks) {
    const v = parseNum(w.projection);
    if (v != null) { sum += v; hasAny = true; }
  }
  return hasAny ? sum : null;
}

// ── Component ───────────────────────────────────────────────

export function FunnelSankey({
  metrics,
  formatCurrency,
  rangeDays = 30,
  youtubeVideosValue,
  emailBroadcastsValue,
  skoolJoinsValue,
  websiteViewsValue,
  webinarJoinsValue,
  youtubeVideosLoading,
  emailBroadcastsLoading,
  skoolJoinsLoading,
  websiteViewsLoading,
  webinarJoinsLoading,
  bookingsGauge,
  showRateGauge,
  closeRateGauge,
  cashGauge,
}: Props) {
  const fmtCur = formatCurrency ?? ((v: number | string | undefined) => {
    const n = v != null ? parseNum(String(v)) : null;
    return n != null ? `$${compact(n)}` : "—";
  });

  const data = useMemo(() => {
    const find = (name: string) => metrics.find((m) => m.name === name);

    /** Scale a monthly scorecard target down to the actual range (≈ days_in_range / 30). */
    const prorate = (monthlyTarget: number | null): number | null => {
      if (monthlyTarget == null) return null;
      return monthlyTarget * (rangeDays / 30);
    };

    const stage = (m: Metric | undefined, label: string, isPercent = false, isCurrency = false): Stage => {
      const v = metricValue(m);
      const t = metricTarget(m);
      const fmtVal = (n: number | null) => {
        if (n == null) return "—";
        if (isPercent) return `${n.toFixed(1)}%`;
        if (isCurrency) return fmtCur(n);
        return compact(n);
      };
      return {
        id: m?.name ?? label,
        label, // Always use the display label override, not the underlying metric name
        value: v,
        target: t,
        formatted: fmtVal(v),
        targetFormatted: fmtVal(t),
        status: m?.status ?? "green",
      };
    };

    const placeholder = (id: string, label: string): Stage => ({
      id, label, value: null, target: null,
      formatted: "—", targetFormatted: "—", status: "green",
      isPlaceholder: true,
    });

    /** Build a stage from explicit live values + a scorecard metric for the target/status hint. */
    const liveStage = (
      id: string,
      label: string,
      value: number | null,
      scorecardMetricName?: string,
      isPercent = false,
      isLoading = false,
    ): Stage => {
      if (isLoading && value == null) {
        // Loading state — keep card visible but show spinner / placeholder values
        return { id, label, value: null, target: null, formatted: "—", targetFormatted: "—", status: "green", isLoading: true };
      }
      if (value == null) return placeholder(id, label);
      const m = scorecardMetricName ? find(scorecardMetricName) : undefined;
      const target = prorate(metricTarget(m));
      const fmtVal = (n: number | null) => n == null ? "—" : isPercent ? `${n.toFixed(1)}%` : compact(n);
      return {
        id, label, value, target,
        formatted: fmtVal(value),
        targetFormatted: fmtVal(target),
        // Re-derive status against pro-rated target
        status: target != null && target > 0
          ? (value >= target ? "green" : value >= target * 0.7 ? "yellow" : "red")
          : (m?.status ?? "green"),
      };
    };

    // Row 1 — Distribution: videos posted (liam_videos), email broadcasts (Kit), social posts, ads
    const distribution: Stage[] = [
      liveStage("youtube-videos", "YouTube videos", youtubeVideosValue ?? null, "Videos posted last week", false, !!youtubeVideosLoading),
      liveStage("email-broadcasts", "Email broadcasts", emailBroadcastsValue ?? null, undefined, false, !!emailBroadcastsLoading),
      placeholder("social-posts", "Social posts"),
      placeholder("ads", "Ads"),
    ];

    // Row 2 — Nurturing: Skool joins (Supabase) + Website views (GA4) + Webinar joins (Kit)
    const nurturing: Stage[] = [
      liveStage("skool-joins", "Skool Joins", skoolJoinsValue ?? null, "Skool Joins", false, !!skoolJoinsLoading),
      liveStage("website-views", "Website Views", websiteViewsValue ?? null, "Website Views", false, !!websiteViewsLoading),
      liveStage("webinar-joins", "Webinar Joins", webinarJoinsValue ?? null, undefined, false, !!webinarJoinsLoading),
    ];

    // Row 3 — Total Bookings
    const totalBookings = stage(find("Total Bookings"), "Total Bookings");

    // Row 4 — Show Rate
    const showRate = stage(find("Closing Call Show Rate"), "Show Rate", true);

    // Row 5 — Close Rate
    const closeRate = stage(find("Closing Call Close Rate"), "Close Rate", true);

    // Row 6 — Cash Collected
    const cashCollected = stage(find("Cash Collected"), "Cash Collected", false, true);

    // Conversion rate hints between consecutive stages (where it makes sense)
    const callsTaken = metricValue(find("Closing Calls Taken"));
    const callsBooked = metricValue(find("Closing Calls Booked"));
    const showPct = pctLabel(callsBooked, callsTaken);

    return { distribution, nurturing, totalBookings, showRate, closeRate, cashCollected, showPct };
  }, [
    metrics, fmtCur, rangeDays,
    youtubeVideosValue, emailBroadcastsValue, skoolJoinsValue, websiteViewsValue, webinarJoinsValue,
    youtubeVideosLoading, emailBroadcastsLoading, skoolJoinsLoading, websiteViewsLoading, webinarJoinsLoading,
  ]);

  // Cockpit funnel: outer width narrows row-by-row from top (widest) to bottom (narrowest).
  // Each row is rendered inside a max-width container that physically shrinks down the page,
  // creating a literal funnel silhouette while the gauges sit as the climactic instruments.
  return (
    <div>
      {/* Funnel silhouette: each row is wrapped in a narrowing width container */}
      <div className="mx-auto py-0 flex flex-col items-center">
        {/* ── Distribution (widest mouth of the funnel) ─────── */}
        <FunnelLevel widthClass="w-full max-w-[1100px]">
          <FunnelRow
            stageLabel="Distribution"
            stages={data.distribution}
            gridCols="grid-cols-2 sm:grid-cols-4"
          />
        </FunnelLevel>

        <FlowArrow />

        {/* ── Nurturing ─────────────────── */}
        <FunnelLevel widthClass="w-full max-w-[940px]">
          <FunnelRow
            stageLabel="Nurturing"
            stages={data.nurturing}
            gridCols="grid-cols-3"
          />
        </FunnelLevel>

        <FlowArrow />

        {/* ── Bookings — gauge instrument (no card chrome) ─────── */}
        <div className="w-full max-w-[600px]">
          <GaugeSlot label="Total Bookings" gauge={bookingsGauge} fallbackStage={data.totalBookings} />
        </div>

        <FlowArrow tight />

        {/* ── Show Rate + Close Rate — paired instruments side by side (no card chrome) ─── */}
        <div className="w-full max-w-[760px]">
          <div className="grid grid-cols-2 gap-3 items-center">
            <GaugeSlot label="Show Rate" gauge={showRateGauge} fallbackStage={data.showRate} />
            <GaugeSlot label="Close Rate" gauge={closeRateGauge} fallbackStage={data.closeRate} />
          </div>
        </div>

        <FlowArrow tight />

        {/* ── Cash Collected — final gauge, narrowest spout (no card chrome) ─────── */}
        <div className="w-full max-w-[420px]">
          <GaugeSlot label="Cash Collected" gauge={cashGauge} fallbackStage={data.cashCollected} />
        </div>
      </div>
    </div>
  );
}

function FlowArrow({ tight = false }: { tight?: boolean }) {
  return (
    <div className={`flex justify-center ${tight ? "-my-3" : "py-1"}`}>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30" strokeWidth={2.5} />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function FunnelRow({
  stageLabel,
  stages,
  gridCols,
  emphasized = false,
}: {
  stageLabel: string;
  stages: Stage[];
  gridCols: string;
  emphasized?: boolean;
}) {
  return (
    <div>
      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center pb-3">
        {stageLabel}
      </p>
      <div className={`grid ${gridCols} gap-1.5`}>
        {stages.map((s) => (
          <FunnelCard key={s.id} stage={s} emphasized={emphasized} />
        ))}
      </div>
    </div>
  );
}

/** Cockpit level-meter: a horizontal progress bar measuring actual against target,
 *  with a glowing knob/indicator at the actual position. Inspired by HUD instrument sliders. */
function FunnelCard({ stage, emphasized }: { stage: Stage; emphasized?: boolean }) {
  const isLoading = !!stage.isLoading;
  const isPlaceholder = !isLoading && (stage.isPlaceholder || stage.value == null);
  const hasTarget = !isLoading && stage.value != null && stage.target != null && stage.target > 0;
  const pct = hasTarget ? Math.min((stage.value! / stage.target!) * 100, 100) : 0;

  // Status-driven gradient + glow colors for the fill bar and indicator knob
  const fillGradient =
    stage.status === "green" || stage.status === "light-green" ? "from-emerald-500/80 via-emerald-400 to-emerald-300"
    : stage.status === "yellow" ? "from-amber-500/80 via-amber-400 to-yellow-300"
    : "from-red-500/80 via-red-400 to-orange-300";

  const knobGlow =
    stage.status === "green" || stage.status === "light-green" ? "rgba(34,197,94,0.7)"
    : stage.status === "yellow" ? "rgba(250,204,21,0.7)"
    : "rgba(239,68,68,0.7)";

  const knobBg =
    stage.status === "green" || stage.status === "light-green" ? "bg-emerald-400"
    : stage.status === "yellow" ? "bg-amber-300"
    : "bg-red-400";

  return (
    <div
      className={[
        "relative rounded-lg px-4 py-5 transition-all",
        "bg-gradient-to-b from-black/40 to-black/60",
        "ring-1 ring-white/10",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_2px_12px_-4px_rgba(0,0,0,0.4)]",
        isPlaceholder && "opacity-50",
      ].filter(Boolean).join(" ")}
    >
      {/* Top row: label (left), actual / target readout (right) */}
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold truncate">
          {stage.label}
        </p>
        <p className="text-[10px] font-mono tabular-nums text-muted-foreground/70 shrink-0 flex items-center gap-1">
          {isLoading ? (
            <LoadingIndicator size={14} className="text-muted-foreground/70" />
          ) : isPlaceholder ? "—" : (
            <>
              <span className="text-foreground font-semibold text-xs">{stage.formatted}</span>
              {stage.targetFormatted !== "—" && (
                <span className="text-muted-foreground/50"> / {stage.targetFormatted}</span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Level meter — horizontal track + gradient fill + glowing knob (or shimmer when loading) */}
      <div className={`relative h-2 rounded-full bg-white/5 ring-1 ring-black/40 ${isLoading ? "overflow-hidden" : "overflow-visible"}`}>
        {/* Loading shimmer */}
        {isLoading && (
          <div
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent animate-[shimmer_1.4s_ease-in-out_infinite]"
            style={{ animation: "shimmer 1.4s ease-in-out infinite" }}
          />
        )}
        {/* Filled portion */}
        {!isPlaceholder && !isLoading && hasTarget && (
          <div
            className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${fillGradient}`}
            style={{
              width: `${pct}%`,
              boxShadow: `0 0 10px 0 ${knobGlow}`,
              transition: "width 600ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        )}
        {/* Knob at the actual position */}
        {!isPlaceholder && !isLoading && hasTarget && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full ${knobBg} ring-2 ring-black/40`}
            style={{
              left: `${pct}%`,
              boxShadow: `0 0 0 2px rgba(255,255,255,0.15)`,
              transition: "left 600ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        )}
        {/* No-target fallback: a centered dim dot so the meter isn't blank */}
        {!isPlaceholder && !isLoading && !hasTarget && stage.value != null && (
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-center">
            <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider">no target</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** A horizontal "level" of the cockpit funnel — a frosted instrument-panel container
 *  that visually narrows as the funnel descends. */
function FunnelLevel({ widthClass, children }: { widthClass: string; children: ReactNode }) {
  return (
    <div className={widthClass}>
      <div
        className={[
          "rounded-xl px-3 py-3",
          "bg-gradient-to-b from-white/[0.03] to-white/[0.01] dark:from-white/[0.025] dark:to-white/[0.005]",
          "backdrop-blur-xl ring-1 ring-white/5",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

/** Render a SpeedometerCard gauge as a funnel stage; falls back to a regular FunnelCard
 *  if no gauge node was provided. The gauge has its own internal label, so we don't
 *  add an outer one here. */
function GaugeSlot({ label, gauge, fallbackStage }: { label: string; gauge: ReactNode; fallbackStage: Stage }) {
  if (!gauge) {
    return (
      <FunnelRow stageLabel={label} stages={[fallbackStage]} gridCols="grid-cols-1" emphasized />
    );
  }
  return <div className="flex justify-center">{gauge}</div>;
}
