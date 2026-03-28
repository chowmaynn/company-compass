import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import type { Metric, StatusColor } from "@/data/scorecardData";

// ── Types ────────────────────────────────────────────────────

interface FunnelNode {
  id: string;
  label: string;
  value: number | null;
  target: number | null;
  formatted: string;
  targetFormatted: string;
  status: StatusColor;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FunnelFlow {
  from: string;
  to: string;
  colorVar: string;
  opacity: number;
  bandW?: number;
}

interface Conversion {
  from: string;
  to: string;
  label: string | null;
}

interface Props {
  metrics: Metric[];
  formatCurrency?: (val: number | string | undefined) => string;
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

function statusColor(status: StatusColor): string {
  if (status === "green" || status === "light-green") return "var(--status-green)";
  if (status === "yellow") return "var(--status-yellow)";
  return "var(--status-red)";
}

// ── Bezier band path (filled shape) ─────────────────────────

function bandPath(x1: number, y1: number, x2: number, y2: number, bw: number): string {
  const cx = (x1 + x2) / 2;
  return [
    `M ${x1},${y1 - bw}`,
    `C ${cx},${y1 - bw} ${cx},${y2 - bw} ${x2},${y2 - bw}`,
    `L ${x2},${y2 + bw}`,
    `C ${cx},${y2 + bw} ${cx},${y1 + bw} ${x1},${y1 + bw}`,
    `Z`,
  ].join(" ");
}

// ── Get best available value: monthlyActual, or sum of weekly actuals ──

function metricValue(m: Metric | undefined): number | null {
  if (!m) return null;
  const monthly = parseNum(m.monthlyActual);
  if (monthly != null) return monthly;
  // Fall back to sum of weekly actuals
  let sum = 0;
  let hasAny = false;
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
  let sum = 0;
  let hasAny = false;
  for (const w of m.weeks) {
    const v = parseNum(w.projection);
    if (v != null) { sum += v; hasAny = true; }
  }
  return hasAny ? sum : null;
}

// ── Data extraction ─────────────────────────────────────────

function useFunnelData(metrics: Metric[], formatCurrency?: (val: number | string | undefined) => string) {
  return useMemo(() => {
    const find = (name: string) => metrics.find((m) => m.name === name);

    const ytViews = find("YouTube views");
    const emailClicks = find("Email Clicks");
    const websiteViews = find("Website Views");
    const skoolJoins = find("Skool Joins");

    const totalBookings = find("Total Bookings");
    const emailBookings = find("Email Bookings");
    const closingCallsTaken = find("Closing Calls Taken");
    const closeRate = find("Closing Call Close Rate");
    const revenue = find("Revenue");

    // Derive booking values
    const totalBookingsVal = metricValue(totalBookings);
    const emailBookingsVal = metricValue(emailBookings);
    const otherBookingsVal = totalBookingsVal != null && emailBookingsVal != null
      ? totalBookingsVal - emailBookingsVal : null;

    // Sales
    const callsTaken = metricValue(closingCallsTaken);
    const rate = closeRate ? parseNum(closeRate.monthlyActual) : null; // rate is already a %
    const salesVal = callsTaken != null && rate != null ? Math.round(callsTaken * (rate / 100)) : null;

    const fmt = (m: Metric | undefined) => {
      const v = metricValue(m);
      return v != null ? compact(v) : "—";
    };
    const fmtTarget = (m: Metric | undefined) => {
      const v = metricTarget(m);
      return v != null ? compact(v) : "—";
    };
    const fmtCur = formatCurrency ?? ((v: number | string | undefined) => {
      const n = v != null ? parseNum(String(v)) : null;
      return n != null ? `$${compact(n)}` : "—";
    });

    // ── Layout: viewBox 960 x 280 (tighter) ──

    // Column 1: Sources (x=0)
    const srcX = 5;
    const srcW = 115;
    const srcH = 48;
    const srcGap = 10;
    const srcStartY = 10;

    // Column 2: Bookings by source (x=220)
    const bkX = 230;
    const bkW = 115;
    const bkH = 48;

    // Column 3: Total Bookings (x=440)
    const totX = 440;
    const totW = 120;
    const totH = 60;
    const totY = 95;

    // Column 4: Sales (x=640)
    const salX = 630;
    const salW = 120;

    // Column 5: Revenue (x=820)
    const revX = 810;
    const revW = 140;

    const nodes: FunnelNode[] = [
      // Sources
      { id: "yt-views", label: "YouTube Views", value: metricValue(ytViews), target: metricTarget(ytViews), formatted: fmt(ytViews), targetFormatted: fmtTarget(ytViews), status: ytViews?.status ?? "green", x: srcX, y: srcStartY, w: srcW, h: srcH },
      { id: "email", label: "Email Clicks", value: metricValue(emailClicks), target: metricTarget(emailClicks), formatted: fmt(emailClicks), targetFormatted: fmtTarget(emailClicks), status: emailClicks?.status ?? "green", x: srcX, y: srcStartY + srcH + srcGap, w: srcW, h: srcH },
      { id: "website", label: "Website Views", value: metricValue(websiteViews), target: metricTarget(websiteViews), formatted: fmt(websiteViews), targetFormatted: fmtTarget(websiteViews), status: websiteViews?.status ?? "green", x: srcX, y: srcStartY + 2 * (srcH + srcGap), w: srcW, h: srcH },
      { id: "skool", label: "Skool Joins", value: metricValue(skoolJoins), target: metricTarget(skoolJoins), formatted: fmt(skoolJoins), targetFormatted: fmtTarget(skoolJoins), status: skoolJoins?.status ?? "green", x: srcX, y: srcStartY + 3 * (srcH + srcGap), w: srcW, h: srcH },

      // Booking types (middle)
      { id: "email-bookings", label: "Email Bookings", value: emailBookingsVal, target: metricTarget(emailBookings), formatted: emailBookingsVal != null ? compact(emailBookingsVal) : "—", targetFormatted: fmtTarget(emailBookings), status: emailBookings?.status ?? "green", x: bkX, y: srcStartY + srcH + srcGap, w: bkW, h: bkH },
      { id: "other-bookings", label: "Web + Skool Bookings", value: otherBookingsVal, target: null, formatted: otherBookingsVal != null ? compact(otherBookingsVal) : "—", targetFormatted: "—", status: "green", x: bkX, y: srcStartY + 2 * (srcH + srcGap) + 5, w: bkW, h: bkH },

      // Aggregates
      { id: "bookings", label: "Total Bookings", value: totalBookingsVal, target: metricTarget(totalBookings), formatted: fmt(totalBookings), targetFormatted: fmtTarget(totalBookings), status: totalBookings?.status ?? "green", x: totX, y: totY, w: totW, h: totH },
      { id: "sales", label: "Sales", value: salesVal, target: null, formatted: salesVal != null ? compact(salesVal) : "—", targetFormatted: "—", status: closeRate?.status ?? "green", x: salX, y: totY, w: salW, h: totH },
      { id: "revenue", label: "Revenue", value: metricValue(revenue), target: metricTarget(revenue), formatted: fmtCur(metricValue(revenue)), targetFormatted: fmtCur(metricTarget(revenue)), status: revenue?.status ?? "green", x: revX, y: totY, w: revW, h: totH },
    ];

    const flows: FunnelFlow[] = [
      // Sources → Booking types
      { from: "yt-views", to: "bookings", colorVar: "--chart-1", opacity: 0.2, bandW: 8 },
      { from: "email", to: "email-bookings", colorVar: "--chart-2", opacity: 0.25, bandW: 10 },
      { from: "website", to: "other-bookings", colorVar: "--chart-3", opacity: 0.25, bandW: 8 },
      { from: "skool", to: "other-bookings", colorVar: "--chart-5", opacity: 0.25, bandW: 8 },
      // Booking types → Total
      { from: "email-bookings", to: "bookings", colorVar: "--chart-2", opacity: 0.2, bandW: 10 },
      { from: "other-bookings", to: "bookings", colorVar: "--chart-3", opacity: 0.2, bandW: 8 },
      // Pipeline
      { from: "bookings", to: "sales", colorVar: "--primary", opacity: 0.18, bandW: 14 },
      { from: "sales", to: "revenue", colorVar: "--primary", opacity: 0.15, bandW: 14 },
    ];

    const revenueVal = metricValue(revenue);

    const conversions: Conversion[] = [
      { from: "bookings", to: "sales", label: pctLabel(totalBookingsVal, salesVal) },
      { from: "sales", to: "revenue", label: revenueVal != null && salesVal ? fmtCur(Math.round(revenueVal / salesVal)) + "/sale" : null },
    ];

    return { nodes, flows, conversions };
  }, [metrics, formatCurrency]);
}

// ── Component ───────────────────────────────────────────────

export function FunnelSankey({ metrics, formatCurrency }: Props) {
  const { nodes, flows, conversions } = useFunnelData(metrics, formatCurrency);
  const [hovered, setHovered] = useState<string | null>(null);

  const nodeMap = useMemo(() => {
    const map: Record<string, FunnelNode> = {};
    for (const n of nodes) map[n.id] = n;
    return map;
  }, [nodes]);

  // All nodes connected to a hovered node
  const connectedIds = useMemo(() => {
    if (!hovered) return new Set<string>();
    const ids = new Set<string>([hovered]);
    for (const f of flows) {
      if (f.from === hovered) ids.add(f.to);
      if (f.to === hovered) ids.add(f.from);
    }
    return ids;
  }, [hovered, flows]);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <svg className="h-4 w-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Conversion Funnel</h2>
      </div>

      <div className="p-3 overflow-hidden">
        <svg viewBox="0 0 960 270" className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Flows */}
          {flows.map((flow) => {
            const fromNode = nodeMap[flow.from];
            const toNode = nodeMap[flow.to];
            if (!fromNode || !toNode) return null;

            const x1 = fromNode.x + fromNode.w;
            const y1 = fromNode.y + fromNode.h / 2;
            const x2 = toNode.x;
            const y2 = toNode.y + toNode.h / 2;
            const bw = flow.bandW ?? 10;

            const isConnected = hovered && (connectedIds.has(flow.from) && connectedIds.has(flow.to));
            const dimmed = hovered && !isConnected;
            const finalOpacity = dimmed ? flow.opacity * 0.15 : isConnected ? flow.opacity * 2.5 : flow.opacity;

            return (
              <path
                key={`${flow.from}-${flow.to}`}
                d={bandPath(x1, y1, x2, y2, bw)}
                fill={`hsl(var(${flow.colorVar}))`}
                opacity={finalOpacity}
                style={{ transition: "opacity 200ms" }}
              />
            );
          })}

          {/* Conversion rate labels */}
          {conversions.map((conv) => {
            if (!conv.label) return null;
            const from = nodeMap[conv.from];
            const to = nodeMap[conv.to];
            if (!from || !to) return null;

            const cx = (from.x + from.w + to.x) / 2;
            const cy = from.y - 4;

            return (
              <g key={`conv-${conv.from}-${conv.to}`}>
                <rect x={cx - 32} y={cy - 10} width={64} height={17} rx={8} fill="hsl(var(--muted))" opacity={0.9} />
                <text x={cx} y={cy + 1} textAnchor="middle" fontSize={9} fontWeight={500} fill="hsl(var(--muted-foreground))">
                  {conv.label}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isHovered = hovered === node.id;
            const dimmed = hovered && !connectedIds.has(node.id);
            const isPipeline = node.h >= 60;

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: "default", transition: "opacity 200ms" }}
                opacity={dimmed ? 0.3 : 1}
              >
                <rect
                  x={node.x} y={node.y} width={node.w} height={node.h} rx={8}
                  fill="hsl(var(--card))"
                  stroke={isHovered ? "hsl(var(--primary))" : "hsl(var(--border))"}
                  strokeWidth={isHovered ? 1.5 : 0.8}
                />
                <circle cx={node.x + node.w - 10} cy={node.y + 10} r={3} fill={statusColor(node.status)} />

                <text
                  x={node.x + node.w / 2}
                  y={node.y + (isPipeline ? node.h / 2 - 6 : node.h / 2 - 3)}
                  textAnchor="middle"
                  fontSize={isPipeline ? 16 : 12}
                  fontWeight={700}
                  fill="hsl(var(--foreground))"
                >
                  {node.formatted}
                </text>

                <text
                  x={node.x + node.w / 2}
                  y={node.y + (isPipeline ? node.h / 2 + 10 : node.h / 2 + 11)}
                  textAnchor="middle"
                  fontSize={isPipeline ? 9 : 8}
                  fill="hsl(var(--muted-foreground))"
                >
                  {node.label}
                </text>

                {isPipeline && node.targetFormatted !== "—" && (
                  <text
                    x={node.x + node.w / 2}
                    y={node.y + node.h / 2 + 23}
                    textAnchor="middle"
                    fontSize={8}
                    fill="hsl(var(--muted-foreground))"
                    opacity={0.6}
                  >
                    Target: {node.targetFormatted}
                  </text>
                )}

                {isHovered && node.value != null && node.target != null && (
                  <g>
                    <rect
                      x={node.x + node.w / 2 - 45} y={node.y + node.h + 4}
                      width={90} height={18} rx={6}
                      fill="hsl(var(--popover))" stroke="hsl(var(--border))" strokeWidth={0.5}
                    />
                    <text
                      x={node.x + node.w / 2} y={node.y + node.h + 16}
                      textAnchor="middle" fontSize={9}
                      fill="hsl(var(--popover-foreground))"
                    >
                      {Math.round((node.value / node.target) * 100)}% of target
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
