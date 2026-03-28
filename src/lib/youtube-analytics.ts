import { getValidAccessToken } from "./youtube-auth";
import { bucketByWeek as genericBucketByWeek } from "@/lib/dates";
import { LIAM_CHANNEL_ID } from "@/lib/constants";

const ANALYTICS_BASE = "https://youtubeanalytics.googleapis.com/v2/reports";
const CHANNEL_ID = LIAM_CHANNEL_ID;

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
 * Buckets daily analytics into weekly totals based on provided week boundaries.
 * Each week is { start, end } as ISO strings. Returns "—" for future weeks.
 * Analytics API dates are YYYY-MM-DD in the channel's local timezone (NZ).
 */
export function bucketByWeek(
  rows: AnalyticsRow[],
  weekConfigs: { start: string; end: string }[]
): { views: (number | "—")[]; subscribersNet: (number | "—")[] } {
  const views = genericBucketByWeek(rows, weekConfigs, (r) => r.views);
  const subscribersNet = genericBucketByWeek(rows, weekConfigs, (r) => r.subscribersGained - r.subscribersLost);
  return { views, subscribersNet };
}
