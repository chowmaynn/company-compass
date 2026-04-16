const KIT_API_KEY = import.meta.env.VITE_KIT_API_KEY;

interface GrowthStats {
  subscribers: number;
  new_subscribers: number;
  net_new_subscribers: number;
  cancellations: number;   // fallback — older API shape
  unsubscribes: number;    // Kit v4 actual field name
}

interface BroadcastStatsEntry {
  id: number;
  stats: {
    recipients: number;
    emails_opened: number;
    // KIT returns open_rate and click_rate already as percentages (e.g. 38.53 = 38.53%)
    open_rate: number;
    click_rate: number;
    total_clicks: number;
    unsubscribes: number;
    status: string;
  };
}

interface Broadcast {
  id: number;
  publication_id: number | null;
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

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        "X-Kit-Api-Key": KIT_API_KEY,
        Accept: "application/json",
      },
    });
  } catch (err) {
    console.error("Kit network error:", path, err);
    return null;
  }

  if (!res.ok) {
    console.error("Kit API error:", res.status, path);
    return null;
  }

  try {
    return await res.json();
  } catch (err) {
    console.error("Kit JSON parse error:", path, err);
    return null;
  }
}

/**
 * Fetch subscriber growth stats for a date range.
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
 * Fetch subscriber count filtered by status.
 * status: "active" | "inactive" (cold) | "cancelled" | "bounced" | "complained"
 * Omit status to get total across all statuses.
 */
export async function fetchSubscriberCount(
  status?: "active" | "inactive" | "cancelled" | "bounced" | "complained"
): Promise<number | null> {
  const params: Record<string, string> = {
    per_page: "1",
    include_total_count: "true",
  };
  if (status) params.status = status;

  const data = await kitFetch<{ subscribers: unknown[]; pagination: { total_count?: number } }>(
    "/v4/subscribers",
    params
  );
  return data?.pagination?.total_count ?? null;
}

/**
 * Fetch per-broadcast link activity and return clicks for URLs matching a filter.
 * KIT v4: GET /v4/broadcasts/{id}/click_summary
 */
export async function fetchCalendlyClicksForBroadcast(
  broadcastId: number,
  urlFilter: string
): Promise<number> {
  const data = await kitFetch<any>(`/v4/broadcasts/${broadcastId}/click_summary`);
  if (!data) return 0;

  // Try different response shapes Kit might return
  const links: any[] =
    data.click_summary ??
    data.links ??
    data.link_activity ??
    (Array.isArray(data) ? data : []);

  const match = links.find(
    (l: any) => (l.url || l.href || "").includes(urlFilter)
  );
  return match?.total_clicks ?? match?.clicks ?? 0;
}

/**
 * Count subscribers who were assigned any tag whose name contains "webinar"
 * within the date range. Sum of per-tag totals — a person registered for
 * multiple webinars in the same window will count once per registration,
 * which is the desired "webinar joins" semantic.
 */
export async function fetchWebinarJoins(
  startDate: string,
  endDate: string
): Promise<number | null> {
  if (!startDate || !endDate) return null;

  // Step 1: list all tags, filter to ones whose name contains "webinar"
  const tagsData = await kitFetch<{ tags: { id: number; name: string }[] }>(
    "/v4/tags",
    { per_page: "500" }
  );
  if (!tagsData?.tags) return null;

  const webinarTags = tagsData.tags.filter((t) =>
    t.name.toLowerCase().includes("webinar")
  );
  if (webinarTags.length === 0) return 0;

  // Step 2: for each webinar tag, count subscribers tagged within the range.
  // We use per_page=1 + include_total_count=true and only read pagination.total_count.
  // NOTE: Kit v4 param names are `tagged_after` / `tagged_before` (NOT `tagged_at_*`).
  // Wrong names are silently ignored and you get the all-time tag total back.
  const taggedAfter = `${startDate}T00:00:00Z`;
  const taggedBefore = `${endDate}T23:59:59Z`;

  const counts = await Promise.all(
    webinarTags.map(async (tag) => {
      const data = await kitFetch<{
        subscribers: unknown[];
        pagination?: { total_count?: number };
      }>(`/v4/tags/${tag.id}/subscribers`, {
        per_page: "1",
        include_total_count: "true",
        tagged_after: taggedAfter,
        tagged_before: taggedBefore,
      });
      return data?.pagination?.total_count ?? 0;
    })
  );

  return counts.reduce((s, n) => s + n, 0);
}

/**
 * Fetch all broadcast stats in bulk (single API call) and the broadcast list,
 * then bucket by week ranges.
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
  const [listData, statsData] = await Promise.all([
    kitFetch<{ broadcasts: Broadcast[] }>("/v4/broadcasts", { per_page: "500" }),
    kitFetch<{ broadcasts: BroadcastStatsEntry[] }>("/v4/broadcasts/stats", { per_page: "500" }),
  ]);

  if (!listData?.broadcasts || !statsData?.broadcasts) {
    return weekRanges.map(() => ({ totalClicks: 0, totalOpens: 0, totalSent: 0, count: 0 }));
  }

  const sendDateMap = new Map<number, string>();
  for (const b of listData.broadcasts) {
    const sentAt = b.published_at || b.send_at;
    if (sentAt) sendDateMap.set(b.id, sentAt);
  }

  const statsMap = new Map<number, BroadcastStatsEntry>();
  for (const s of statsData.broadcasts) statsMap.set(s.id, s);

  return weekRanges.map(({ start, end }) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    let totalClicks = 0, totalOpens = 0, totalSent = 0, count = 0;

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

export interface BroadcastItem {
  id: number;
  publicationId: number | null;
  subject: string;
  sentAt: string;
  recipients: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  // KIT returns these already as percentages (e.g. 38.53 means 38.53%)
  openRate: number;
  clickRate: number;
  calendlyClicks: number;
}

export interface BroadcastsResult {
  broadcasts: BroadcastItem[];
  /**
   * All recipient counts from broadcasts with recipients >= FULL_LIST_THRESHOLD (80K),
   * across ALL history (no date filter). Used to estimate cold subscribers:
   *   warmListSize = max(counts where count < activeSubs * 0.80)
   *   cold ≈ activeSubs − warmListSize
   * The 0.80 cap excludes combined warm+cold sends (which approach 100% of active).
   */
  fullListRecipientCounts: number[];
}

const FULL_LIST_THRESHOLD = 80_000;

/**
 * Fetch all broadcasts sent within a date range with per-broadcast stats.
 * Also fetches Calendly-specific link clicks per broadcast.
 * Collects all full-list send recipient counts across ALL history for cold sub estimation.
 */
export async function fetchBroadcastsInRange(
  start: string,
  end: string
): Promise<BroadcastsResult> {
  const [listData, statsData] = await Promise.all([
    kitFetch<{ broadcasts: Broadcast[] }>("/v4/broadcasts", { per_page: "500" }),
    kitFetch<{ broadcasts: BroadcastStatsEntry[] }>("/v4/broadcasts/stats", { per_page: "500" }),
  ]);

  if (!listData?.broadcasts || !statsData?.broadcasts) {
    return { broadcasts: [], fullListRecipientCounts: [] };
  }

  const statsMap = new Map<number, BroadcastStatsEntry>();
  for (const s of statsData.broadcasts) statsMap.set(s.id, s);

  // ── Collect all full-list send counts across ALL history (no date filter) ──
  const fullListRecipientCounts: number[] = [];
  for (const b of listData.broadcasts) {
    const s = statsMap.get(b.id);
    if (s && s.stats.recipients >= FULL_LIST_THRESHOLD) {
      fullListRecipientCounts.push(s.stats.recipients);
    }
  }

  // ── Date-filtered broadcasts for the table ────────────────────────────────
  const startDate = new Date(start);
  const endDate = new Date(end);

  const filtered = listData.broadcasts
    .filter((b) => {
      const sentAt = b.published_at || b.send_at;
      if (!sentAt) return false;
      const d = new Date(sentAt);
      if (d < startDate || d > endDate) return false;
      // Exclude drafts that were never actually sent
      const s = statsMap.get(b.id);
      if (s?.stats.status === "draft") return false;
      return true;
    })
    .map((b) => {
      const sentAt = b.published_at || b.send_at || "";
      const s = statsMap.get(b.id);
      return {
        id: b.id,
        publicationId: b.publication_id ?? null,
        subject: b.subject,
        sentAt,
        recipients: s?.stats.recipients ?? 0,
        opens: s?.stats.emails_opened ?? 0,
        clicks: s?.stats.total_clicks ?? 0,
        unsubscribes: s?.stats.unsubscribes ?? 0,
        openRate: s?.stats.open_rate ?? 0,
        clickRate: s?.stats.click_rate ?? 0,
        calendlyClicks: 0,
      };
    })
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  return {
    broadcasts: filtered,
    fullListRecipientCounts,
  };
}
