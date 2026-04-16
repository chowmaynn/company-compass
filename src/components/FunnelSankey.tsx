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
  /** Booking source attribution — shows as labeled lines from Nurturing → Bookings */
  skoolBookings?: number;
  websiteBookings?: number;
  webinarBookings?: number;
  /** Bitly click attribution — shows as labeled lines from YouTube Videos → Nurturing */
  ytToSkoolClicks?: number | null;
  ytToWebsiteClicks?: number | null;
  /** Subset of the above: clicks driven specifically by videos published IN the selected range.
   *  Rendered as a blue overlay so you can see "what new content is driving" vs the cumulative grey. */
  ytFromRangeVideosToSkool?: number | null;
  ytFromRangeVideosToWebsite?: number | null;
  /** Skool → Website (Bitly skool-accelerator clicks) — drawn as a horizontal arc */
  skoolToWebsiteClicks?: number | null;
  /** Loading flags so the YT→Nurturing lines can shimmer while data is being fetched */
  ytClicksLoading?: boolean;
  ytPerVideoLoading?: boolean;
  /** Loading flag so Nurturing→Bookings lines shimmer while booking attribution loads */
  bookingsAttributionLoading?: boolean;
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
  skoolBookings = 0,
  websiteBookings = 0,
  webinarBookings = 0,
  ytToSkoolClicks,
  ytToWebsiteClicks,
  ytFromRangeVideosToSkool,
  ytFromRangeVideosToWebsite,
  skoolToWebsiteClicks,
  ytClicksLoading,
  ytPerVideoLoading,
  bookingsAttributionLoading,
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

        {/* Bitly click attribution from the YouTube Videos card down to Skool / Website */}
        <YouTubeToNurturingConnector
          ytToSkool={ytToSkoolClicks ?? 0}
          ytToWebsite={ytToWebsiteClicks ?? 0}
          ytToSkoolFromNew={ytFromRangeVideosToSkool ?? 0}
          ytToWebsiteFromNew={ytFromRangeVideosToWebsite ?? 0}
          loadingBase={!!ytClicksLoading}
          loadingFromNew={!!ytPerVideoLoading}
        />

        {/* ── Nurturing — custom layout that injects a slim Skool→Web indicator
            column between the Skool and Website cards (instead of an arc above). ── */}
        <FunnelLevel widthClass="w-full max-w-[940px]">
          <div>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center pb-3">
              Nurturing
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr_1fr] gap-1.5 items-center">
              <FunnelCard stage={data.nurturing[0]} />
              <SkoolToWebIndicator
                count={skoolToWebsiteClicks ?? 0}
                loading={!!ytClicksLoading}
              />
              <FunnelCard stage={data.nurturing[1]} />
              <FunnelCard stage={data.nurturing[2]} />
            </div>
          </div>
        </FunnelLevel>

        {/* Source-attribution flow lines from Nurturing to Bookings */}
        <NurturingToBookingsConnector
          skoolCount={skoolBookings}
          websiteCount={websiteBookings}
          webinarCount={webinarBookings}
          loading={!!bookingsAttributionLoading}
        />

        {/* ── Bookings — gauge instrument (no card chrome) ─────── */}
        <div className="w-full max-w-[600px]">
          <GaugeSlot label="Total Bookings" gauge={bookingsGauge} fallbackStage={data.totalBookings} />
        </div>

        {/* ── Show Rate + Close Rate — paired instruments side by side (no card chrome) ─── */}
        <div className="w-full max-w-[760px]">
          <div className="grid grid-cols-2 gap-3 items-center">
            <GaugeSlot label="Show Rate" gauge={showRateGauge} fallbackStage={data.showRate} />
            <GaugeSlot label="Close Rate" gauge={closeRateGauge} fallbackStage={data.closeRate} />
          </div>
        </div>

        {/* ── Cash Collected — final gauge, narrowest spout (no card chrome) ─────── */}
        <div className="w-full max-w-[420px]">
          <GaugeSlot label="Cash Collected" gauge={cashGauge} fallbackStage={data.cashCollected} />
        </div>
      </div>
    </div>
  );
}

/** Inline lateral-flow indicator that lives in its OWN column inside the Nurturing row,
 *  between the Skool Joins and Website Views cards. A short dotted line spans the
 *  column with a count pill centered on it. */
function SkoolToWebIndicator({ count, loading }: { count: number; loading?: boolean }) {
  return (
    <div className="relative flex items-center justify-center min-w-[64px] px-1">
      {/* Dotted bridge line — spans the full column width behind the pill */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-emerald-400/40 pointer-events-none" />

      {/* Centered pill — count or loader */}
      {loading ? (
        <div className="relative bg-background/95 px-2 py-1 rounded-full ring-1 ring-emerald-400/30 backdrop-blur-sm flex items-center text-emerald-300/70">
          <LoadingIndicator size={12} className="text-emerald-300/70" />
        </div>
      ) : count > 0 ? (
        <div className="relative bg-background/95 px-2 py-0.5 rounded-full ring-1 ring-emerald-400/40 backdrop-blur-sm text-[11px] font-mono font-semibold tabular-nums shadow-sm flex items-center gap-1 whitespace-nowrap text-foreground">
          <span className="text-emerald-300/70">→</span>
          {count}
        </div>
      ) : null}
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

/** Source-attribution lines drawn from each Nurturing card down to the Bookings gauge.
 *  Three converging paths (Skool / Website / Webinar) with the booking count labeled
 *  at each line's midpoint. Stroke weight scales with the relative count so heavy
 *  contributors visibly carry more flow. While loading, the lines render as subtle
 *  guides with a scanning shimmer overlay. */
function NurturingToBookingsConnector({
  skoolCount,
  websiteCount,
  webinarCount,
  loading = false,
}: {
  skoolCount: number;
  websiteCount: number;
  webinarCount: number;
  loading?: boolean;
}) {
  const total = skoolCount + websiteCount + webinarCount;
  // While loading or fully empty, still draw the three guide rails so users see
  // where the flow is "going to be". Only fall back to the chevron arrow if data
  // has loaded AND every source is zero (genuinely no attribution).
  if (!loading && total === 0) {
    return <FlowArrow />;
  }

  // Stroke weight: 1px floor so the line is visible even at 0 share, scaled up
  // to a 4px ceiling so a single dominant source doesn't drown the others out.
  const sw = (count: number) => count === 0 ? 0 : Math.max(1, Math.min(4, (count / total) * 6));
  const baseSw = (count: number) => count > 0 ? sw(count) : 1.5;
  const shimmerStyle = {
    strokeDasharray: "12 100",
    animation: "line-shimmer 1.6s linear infinite",
  } as const;

  // viewBox geometry — Nurturing row is max-w-[940px] with 3 cards in a grid.
  // Card centers land at ~1/6, 1/2, 5/6 of the row (≈157, 470, 783).
  // Bookings card sits centered (max-w-[600px]) → its top center is at x=470.
  const W = 940;
  const H = 60;
  const xSkool = 157;
  const xWebsite = 470;
  const xWebinar = 783;
  const xDest = 470;

  // Quadratic Bezier mid control point sits halfway down between source and dest
  const skoolPath = `M ${xSkool} 4 Q ${xSkool} ${H * 0.55} ${xDest} ${H - 6}`;
  const webPath = `M ${xWebsite} 4 L ${xDest} ${H - 6}`;
  const webinarPath = `M ${xWebinar} 4 Q ${xWebinar} ${H * 0.55} ${xDest} ${H - 6}`;

  // Label positions — placed roughly at the bezier midpoint of each line
  const labelY = H * 0.55;
  const skoolLabelX = (xSkool + xDest) / 2 - 30;
  const websiteLabelX = xDest;
  const webinarLabelX = (xWebinar + xDest) / 2 + 30;

  return (
    <div className="relative w-full max-w-[940px] mx-auto py-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12 overflow-visible" preserveAspectRatio="none">
        {/* Base guide lines — always rendered so users always see where the flow goes */}
        <path d={skoolPath} stroke="currentColor" strokeWidth={baseSw(skoolCount)} fill="none" className="text-muted-foreground/40" />
        <path d={webPath} stroke="currentColor" strokeWidth={baseSw(websiteCount)} fill="none" className="text-muted-foreground/40" />
        <path d={webinarPath} stroke="currentColor" strokeWidth={baseSw(webinarCount)} fill="none" className="text-muted-foreground/40" />

        {/* Loading shimmer: scanning highlight travels along each line */}
        {loading && (
          <>
            <path d={skoolPath} pathLength={100} stroke="rgb(255 255 255)" strokeWidth={1.6} fill="none" opacity={0.7} strokeLinecap="round" style={shimmerStyle} />
            <path d={webPath} pathLength={100} stroke="rgb(255 255 255)" strokeWidth={1.6} fill="none" opacity={0.7} strokeLinecap="round" style={shimmerStyle} />
            <path d={webinarPath} pathLength={100} stroke="rgb(255 255 255)" strokeWidth={1.6} fill="none" opacity={0.7} strokeLinecap="round" style={shimmerStyle} />
          </>
        )}
      </svg>

      {/* Labels as HTML overlay so the text stays crisp regardless of how the SVG stretches */}
      {!loading && skoolCount > 0 && (
        <FlowLabel leftPct={(skoolLabelX / W) * 100} topPct={(labelY / H) * 100} count={skoolCount} />
      )}
      {!loading && websiteCount > 0 && (
        <FlowLabel leftPct={(websiteLabelX / W) * 100} topPct={(labelY / H) * 100} count={websiteCount} />
      )}
      {!loading && webinarCount > 0 && (
        <FlowLabel leftPct={(webinarLabelX / W) * 100} topPct={(labelY / H) * 100} count={webinarCount} />
      )}
    </div>
  );
}

function FlowLabel({
  leftPct,
  topPct,
  count,
  caption,
  accent,
}: {
  leftPct: number;
  topPct: number;
  count: number;
  /** Short destination/direction tag shown before the count, e.g. "→ Skool". */
  caption?: string;
  accent?: "blue" | "amber" | "emerald";
}) {
  // Color cues for the ring/caption based on destination/series
  const accentMap: Record<NonNullable<typeof accent>, { ring: string; caption: string }> = {
    blue: { ring: "ring-blue-400/50", caption: "text-blue-300/80" },
    amber: { ring: "ring-amber-400/50", caption: "text-amber-300/80" },
    emerald: { ring: "ring-emerald-400/50", caption: "text-emerald-300/80" },
  };
  const a = accent ? accentMap[accent] : { ring: "ring-white/20", caption: "text-muted-foreground/70" };

  return (
    <div
      className={`absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-0.5 rounded-full bg-background/95 ring-1 ${a.ring} backdrop-blur-sm text-[11px] font-mono font-semibold tabular-nums shadow-sm flex items-center gap-1.5 whitespace-nowrap`}
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}
    >
      {caption && (
        <span className={`text-[9px] uppercase tracking-wider font-semibold ${a.caption}`}>
          {caption}
        </span>
      )}
      <span className="text-foreground">{count}</span>
    </div>
  );
}

/** Bitly click attribution lines from the YouTube Videos card (Distribution row, col 1)
 *  down to the Skool Joins (col 1) and Website Views (col 2) cards in the Nurturing row.
 *  Two layers:
 *    - Grey base line: ALL clicks from any video in the range
 *    - Blue overlay line: clicks driven specifically by videos PUBLISHED in the range
 *
 *  When loading, the lines are always rendered (since YT → Skool/Website traffic is
 *  always non-zero) and a "scanning light" shimmer travels along each path until data arrives.
 */
function YouTubeToNurturingConnector({
  ytToSkool,
  ytToWebsite,
  ytToSkoolFromNew,
  ytToWebsiteFromNew,
  loadingBase = false,
  loadingFromNew = false,
}: {
  ytToSkool: number;
  ytToWebsite: number;
  ytToSkoolFromNew: number;
  ytToWebsiteFromNew: number;
  loadingBase?: boolean;
  loadingFromNew?: boolean;
}) {
  const total = ytToSkool + ytToWebsite;

  const sw = (count: number) => count === 0 ? 0 : Math.max(1, Math.min(4, (count / total) * 6));
  // Blue overlay: thinner than the grey base so both are visible
  const blueSw = (count: number) => count === 0 ? 0 : Math.max(1, Math.min(2.5, (count / total) * 5));

  // Use the wider of the two adjoining rows (Distribution = 1100) as the SVG width
  // so card centers from both rows can be placed in the same coordinate space.
  const W = 1100;
  const H = 60;

  // Distribution row (1100 wide, 4 cards) — YT card center at 1/8 of width
  const xYouTube = W * (1 / 8); // 137.5

  // Nurturing row (940 wide, 3 cards) is centered inside the 1100-wide span.
  // Offset = (1100 - 940) / 2 = 80, then +20 visual nudge so lines land on card centers.
  const nurtOffset = (W - 940) / 2 + 20;
  const xSkool = nurtOffset + 940 * (1 / 6);  // 100 + 156.7 = 256.7
  const xWebsite = nurtOffset + 940 * (3 / 6); // 100 + 470   = 570

  // Cubic Bezier control points for each line, kept in variables so we can both
  // build the SVG path AND evaluate the curve at a parameter t to position labels
  // exactly ON the line.
  type Pt = [number, number];
  const skoolP0: Pt = [xYouTube, 4],   skoolP1: Pt = [xYouTube, H * 0.6],   skoolP2: Pt = [xSkool, H * 0.4],   skoolP3: Pt = [xSkool, H - 6];
  const webP0:   Pt = [xYouTube, 4],   webP1:   Pt = [xYouTube, H * 0.65],  webP2:   Pt = [xWebsite, H * 0.35], webP3:   Pt = [xWebsite, H - 6];
  const skoolPath = `M ${skoolP0[0]} ${skoolP0[1]} C ${skoolP1[0]} ${skoolP1[1]} ${skoolP2[0]} ${skoolP2[1]} ${skoolP3[0]} ${skoolP3[1]}`;
  const websitePath = `M ${webP0[0]} ${webP0[1]} C ${webP1[0]} ${webP1[1]} ${webP2[0]} ${webP2[1]} ${webP3[0]} ${webP3[1]}`;

  /** Evaluate a cubic Bezier at parameter t (0 = start, 1 = end). */
  const bezier = (t: number, p0: Pt, p1: Pt, p2: Pt, p3: Pt): Pt => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  };

  // Place each label exactly on its own curve at t = 0.7 (just past the midpoint,
  // where the two curves have visibly fanned apart and labels can't collide).
  const [skoolLabelX, skoolLabelY] = bezier(0.7, skoolP0, skoolP1, skoolP2, skoolP3);
  const [websiteLabelX, websiteLabelY] = bezier(0.7, webP0, webP1, webP2, webP3);

  // Stroke width to use for the base line when we don't yet have data (loading) or
  // when no clicks were attributed — keeps the path visible as a thin guide rail.
  const baseSw = (count: number) => count > 0 ? sw(count) : 1.5;

  // Shimmer overlay shared style — a small bright dash travels along the path
  const shimmerStyle = {
    strokeDasharray: "12 100",
    animation: "line-shimmer 1.6s linear infinite",
  } as const;

  return (
    <div className="relative w-full max-w-[1100px] mx-auto py-1">
      {/* Tiny caption anchoring the connector area */}
      <div className="absolute left-2 top-0 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 pointer-events-none">
        Bitly Clicks
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12 overflow-visible" preserveAspectRatio="none">
        {/* Color-coded lines by destination: amber = → Skool, emerald = → Website */}
        <path d={skoolPath} stroke="rgb(251 191 36)" strokeWidth={baseSw(ytToSkool)} fill="none" opacity={0.55} />
        <path d={websitePath} stroke="rgb(52 211 153)" strokeWidth={baseSw(ytToWebsite)} fill="none" opacity={0.55} />

        {/* Loading shimmer: a small bright segment scans along each line while data is loading */}
        {loadingBase && (
          <>
            <path
              d={skoolPath}
              pathLength={100}
              stroke="rgb(255 255 255)"
              strokeWidth={1.6}
              fill="none"
              opacity={0.7}
              strokeLinecap="round"
              style={shimmerStyle}
            />
            <path
              d={websitePath}
              pathLength={100}
              stroke="rgb(255 255 255)"
              strokeWidth={1.6}
              fill="none"
              opacity={0.7}
              strokeLinecap="round"
              style={shimmerStyle}
            />
          </>
        )}

        {/* Blue overlay: clicks driven by videos PUBLISHED in this range */}
        {ytToSkoolFromNew > 0 && (
          <path
            d={skoolPath}
            stroke="rgb(96 165 250)"
            strokeWidth={blueSw(ytToSkoolFromNew)}
            fill="none"
            opacity={0.85}
          />
        )}
        {ytToWebsiteFromNew > 0 && (
          <path
            d={websitePath}
            stroke="rgb(96 165 250)"
            strokeWidth={blueSw(ytToWebsiteFromNew)}
            fill="none"
            opacity={0.85}
          />
        )}
        {/* Loading shimmer for the blue overlay too — slightly faster, in blue */}
        {loadingFromNew && !loadingBase && (
          <>
            <path
              d={skoolPath}
              pathLength={100}
              stroke="rgb(96 165 250)"
              strokeWidth={1.4}
              fill="none"
              opacity={0.7}
              strokeLinecap="round"
              style={{ strokeDasharray: "10 100", animation: "line-shimmer 1.3s linear infinite" }}
            />
            <path
              d={websitePath}
              pathLength={100}
              stroke="rgb(96 165 250)"
              strokeWidth={1.4}
              fill="none"
              opacity={0.7}
              strokeLinecap="round"
              style={{ strokeDasharray: "10 100", animation: "line-shimmer 1.3s linear infinite" }}
            />
          </>
        )}
      </svg>

      {/* Cumulative labels — sit exactly on each curve at t=0.7 */}
      {!loadingBase && ytToSkool > 0 && (
        <FlowLabel
          leftPct={(skoolLabelX / W) * 100}
          topPct={(skoolLabelY / H) * 100}
          count={ytToSkool}
          caption="→ Skool"
          accent="amber"
        />
      )}
      {!loadingBase && ytToWebsite > 0 && (
        <FlowLabel
          leftPct={(websiteLabelX / W) * 100}
          topPct={(websiteLabelY / H) * 100}
          count={ytToWebsite}
          caption="→ Web"
          accent="emerald"
        />
      )}
      {/* Blue "from new" labels — small offset below their primary label */}
      {!loadingFromNew && ytToSkoolFromNew > 0 && (
        <FlowLabel
          leftPct={(skoolLabelX / W) * 100}
          topPct={(skoolLabelY / H) * 100 + 28}
          count={ytToSkoolFromNew}
          caption="from new"
          accent="blue"
        />
      )}
      {!loadingFromNew && ytToWebsiteFromNew > 0 && (
        <FlowLabel
          leftPct={(websiteLabelX / W) * 100}
          topPct={(websiteLabelY / H) * 100 + 28}
          count={ytToWebsiteFromNew}
          caption="from new"
          accent="blue"
        />
      )}
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
