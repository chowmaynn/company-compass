import { getValidAccessToken } from "./youtube-auth";

const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";
const CHANNEL_ID = "UCui4jxDaMb53Gdh-AZUTPAg"; // Liam Ottley

interface AnalyticsRow {
  date: string; // YYYY-MM-DD
  views: number;
  subscribersGained: number;
  subscribersLost: number;
}

/**
 * Fetches daily YouTube Analytics data (views, subscriber gains/losses) for a date range.
 * Dates should be in YYYY-MM-DD format.
 */
export async function getDailyAnalytics(
  startDate: string,
  endDate: string
): Promise<AnalyticsRow[]> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error("Not authorized — please connect YouTube Analytics");

  const params = new URLSearchParams({
    ids: "channel==mine",
    startDate,
    endDate,
    metrics: "views,subscribersGained,subscribersLost",
    dimensions: "day",
    sort: "day",
  });

  const res = await fetch(`${ANALYTICS_BASE}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Analytics API error: ${res.status}`);
  }

  const data = await res.json();
  return (data.rows || []).map((row: any[]) => ({
    date: row[0],
    views: row[1],
    subscribersGained: row[2],
    subscribersLost: row[3],
  }));
}

/**
 * Convert a UTC ISO timestamp to a YYYY-MM-DD string in NZ timezone.
 * The weekConfigs store boundaries as UTC timestamps representing NZ midnight,
 * so we convert them to NZ calendar dates for comparison with Analytics API dates.
 */
function toNZDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" }); // en-CA gives YYYY-MM-DD
}

/**
 * Buckets daily analytics into weekly totals based on provided week boundaries.
 * Each week is { start, end } as ISO strings. Returns "—" for future weeks.
 * Analytics API dates are YYYY-MM-DD in the channel's local timezone (NZ).
 */
export function bucketByWeek(
  rows: AnalyticsRow[],
  weekConfigs: { start: string; end: string }[]
): { views: (number | "—")[]; subscribersNet: (number | "—")[] } {
  const now = new Date();

  const views: (number | "—")[] = weekConfigs.map((wc) => {
    const start = new Date(wc.start);
    if (start > now) return "—";
    const startDate = toNZDate(wc.start);
    const endDate = toNZDate(wc.end);
    return rows
      .filter((r) => r.date >= startDate && r.date < endDate)
      .reduce((sum, r) => sum + r.views, 0);
  });

  const subscribersNet: (number | "—")[] = weekConfigs.map((wc) => {
    const start = new Date(wc.start);
    if (start > now) return "—";
    const startDate = toNZDate(wc.start);
    const endDate = toNZDate(wc.end);
    return rows
      .filter((r) => r.date >= startDate && r.date < endDate)
      .reduce((sum, r) => sum + r.subscribersGained - r.subscribersLost, 0);
  });

  return { views, subscribersNet };
}
