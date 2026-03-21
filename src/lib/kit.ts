const KIT_API_KEY = import.meta.env.VITE_KIT_API_KEY;

interface GrowthStats {
  subscribers: number;
  new_subscribers: number;
  net_new_subscribers: number;
  cancellations: number;
}

interface BroadcastStatsEntry {
  id: number;
  stats: {
    recipients: number;
    emails_opened: number;
    open_rate: number;
    click_rate: number;
    total_clicks: number;
    unsubscribes: number;
    status: string;
  };
}

interface Broadcast {
  id: number;
  subject: string;
  created_at: string;
  send_at: string | null;
  published_at: string | null;
}

async function kitFetch<T>(path: string, params?: Record<string, string>): Promise<T | null> {
  if (!KIT_API_KEY) return null;

  const url = new URL(`/api/kit${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      "X-Kit-Api-Key": KIT_API_KEY,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    console.error("Kit API error:", res.status, await res.text());
    return null;
  }

  return res.json();
}

/**
 * Fetch subscriber growth stats for a date range.
 * Returns aggregate new/net subscribers for the period.
 */
export async function fetchGrowthStats(
  starting: string,
  ending: string
): Promise<GrowthStats | null> {
  const data = await kitFetch<{ account: { growth_stats: GrowthStats } }>(
    "/v4/account/growth_stats",
    { starting, ending }
  );
  return data?.account?.growth_stats ?? null;
}

/**
 * Fetch all broadcast stats in bulk (single API call) and the broadcast list,
 * then bucket by week ranges.
 * Returns per-week aggregated stats.
 */
export interface WeekBroadcastStats {
  totalClicks: number;
  totalOpens: number;
  totalSent: number;
  count: number;
}

export async function fetchAllBroadcastStats(
  weekRanges: { start: string; end: string }[]
): Promise<WeekBroadcastStats[]> {
  // Two API calls total: broadcast list + bulk stats
  const [listData, statsData] = await Promise.all([
    kitFetch<{ broadcasts: Broadcast[] }>("/v4/broadcasts", { per_page: "500" }),
    kitFetch<{ broadcasts: BroadcastStatsEntry[] }>("/v4/broadcasts/stats", { per_page: "500" }),
  ]);

  if (!listData?.broadcasts || !statsData?.broadcasts) {
    return weekRanges.map(() => ({ totalClicks: 0, totalOpens: 0, totalSent: 0, count: 0 }));
  }

  // Build a map of broadcast id → send date from the list endpoint
  const sendDateMap = new Map<number, string>();
  for (const b of listData.broadcasts) {
    const sentAt = b.published_at || b.send_at;
    if (sentAt) sendDateMap.set(b.id, sentAt);
  }

  // Build a map of broadcast id → stats
  const statsMap = new Map<number, BroadcastStatsEntry>();
  for (const s of statsData.broadcasts) {
    statsMap.set(s.id, s);
  }

  // Bucket broadcasts into weeks
  return weekRanges.map(({ start, end }) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    let totalClicks = 0;
    let totalOpens = 0;
    let totalSent = 0;
    let count = 0;

    for (const [id, sentAt] of sendDateMap.entries()) {
      const d = new Date(sentAt);
      if (d >= startDate && d < endDate) {
        const entry = statsMap.get(id);
        if (entry) {
          totalClicks += entry.stats.total_clicks;
          totalOpens += entry.stats.emails_opened;
          totalSent += entry.stats.recipients;
          count++;
        }
      }
    }

    return { totalClicks, totalOpens, totalSent, count };
  });
}

/**
 * Fetch total subscriber count.
 */
export async function fetchSubscriberCount(): Promise<number | null> {
  const data = await kitFetch<{ subscribers: unknown[]; pagination: { total_count?: number } }>(
    "/v4/subscribers",
    { per_page: "1", include_total_count: "true", status: "active" }
  );
  return data?.pagination?.total_count ?? null;
}
