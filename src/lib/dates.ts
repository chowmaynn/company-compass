/**
 * Shared date/time utilities — single source of truth.
 *
 * Previously duplicated across google-analytics.ts, bitly.ts,
 * use-google-analytics.ts, DateRangePicker.tsx, BookingsDashboard.tsx,
 * ProductDashboard.tsx, CircleCharts.tsx, RepMetrics.tsx, SalesDashboard.tsx,
 * SubscriptionDashboard.tsx, SupportDashboard.tsx, use-calendly.ts,
 * use-close.ts, use-rep-metrics.ts, youtube-analytics.ts.
 */

/**
 * Convert a UTC ISO timestamp (or Date) to a YYYY-MM-DD string in NZ timezone.
 * The weekConfigs store boundaries as UTC timestamps representing NZ midnight,
 * so we convert them to NZ calendar dates for comparison with Analytics API dates.
 * `en-CA` locale gives YYYY-MM-DD format.
 */
export function toNZDate(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}

/**
 * Format a date string (YYYY-MM-DD or ISO) as "D/M" for chart axis labels.
 */
export function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/**
 * ISO start-of-current-month with microsecond precision (for Calendly API).
 * Example: "2026-03-01T00:00:00.000000Z"
 */
export function startOfMonthISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01T00:00:00.000000Z`;
}

/**
 * YYYY-MM-DD start-of-current-month (for Close.com / general use).
 * Example: "2026-03-01"
 */
export function startOfMonthDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * ISO end-of-current-month with microsecond precision (for Calendly API).
 * Example: "2026-03-31T23:59:59.000000Z"
 */
export function endOfMonthISO(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const y = last.getFullYear();
  const m = String(last.getMonth() + 1).padStart(2, "0");
  const day = String(last.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T23:59:59.000000Z`;
}

/**
 * Format "YYYY-MM" as "Mon YY" (e.g. "2026-03" → "Mar 26").
 */
export function formatYearMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${names[parseInt(month) - 1]} ${year.slice(2)}`;
}

/**
 * Relative elapsed time from a Unix timestamp (seconds) to now.
 * Examples: "5m", "3h 12m", "2d 4h", "2d"
 */
export function elapsed(ts: number): string {
  const secs = Math.floor(Date.now() / 1000) - ts;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

/**
 * Format a duration in seconds as a human-readable string.
 * Examples: "12m", "1h 30m", "2h"
 */
export function fmtDuration(secs: number): string {
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Generic weekly bucketing — replaces bucketViewsByWeek, bucketClicksByWeek,
 * and the youtube-analytics bucketByWeek helpers.
 *
 * Takes any array of rows, a list of week boundaries, and an accessor that
 * extracts the numeric value to sum from each row. Rows must have a `date`
 * field (YYYY-MM-DD). Returns "—" for future weeks.
 */
export function bucketByWeek<T extends { date: string }>(
  rows: T[],
  weekConfigs: { start: string; end: string }[],
  accessor: (row: T) => number,
): (number | "—")[] {
  const now = new Date();

  return weekConfigs.map((wc) => {
    const start = new Date(wc.start);
    if (start > now) return "—";

    const startDate = toNZDate(wc.start);
    const endDate = toNZDate(wc.end);

    return rows
      .filter((r) => r.date >= startDate && r.date < endDate)
      .reduce((sum, r) => sum + accessor(r), 0);
  });
}
