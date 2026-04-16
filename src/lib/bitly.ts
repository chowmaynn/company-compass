import { SUPABASE_URL, getSupabaseHeaders } from "@/lib/supabase";
import { bucketByWeek } from "@/lib/dates";

const BITLY_TOKEN = "2a5c70f0612f7fbe8baa0790acb7ce5d588bba35";
const BITLY_BASE = "https://api-ssl.bitly.com/v4";

export type BitlyCategory = "yt-skool" | "yt-accelerator" | "skool-accelerator" | "aios-webinar";

interface ClicksByDay {
  date: string;
  clicks: number;
}

export interface DailyClickRow {
  date: string; // YYYY-MM-DD
  clicks: number;
}

// ── Supabase: fetch link IDs by category ──────────────────────

async function fetchLinkIdsByCategory(category: string): Promise<string[]> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/bitly_links?select=bitly_shortlink&category=eq.${category}`,
    { headers }
  );
  if (!res.ok) return [];
  const rows: { bitly_shortlink: string }[] = await res.json();
  return rows.map((r) => r.bitly_shortlink);
}

// ── Bitly API ─────────────────────────────────────────────────

async function bitlyFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BITLY_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Bitly API error: ${res.status}`);
  return res.json();
}

async function fetchDailyClicks(bitlink: string, units: number): Promise<ClicksByDay[]> {
  const data = await bitlyFetch<{ link_clicks: ClicksByDay[] }>(
    `${BITLY_BASE}/bitlinks/${bitlink}/clicks?unit=day&units=${units}`
  );
  return data.link_clicks || [];
}

// ── Main: fetch + aggregate ───────────────────────────────────

/**
 * Fetches link IDs from Supabase bitly_links table by category,
 * then fetches daily clicks from Bitly API for each link.
 * Processes links in batches of 10 to avoid rate limits.
 */
export async function getCategorizedClicks(
  days: number = 31
): Promise<Map<BitlyCategory, DailyClickRow[]>> {
  const categories: BitlyCategory[] = ["yt-skool", "yt-accelerator", "skool-accelerator", "aios-webinar"];
  const result = new Map<BitlyCategory, DailyClickRow[]>();

  // Fetch all link IDs from Supabase in parallel
  const linkIdsByCategory = await Promise.all(
    categories.map(async (cat) => ({
      category: cat,
      links: await fetchLinkIdsByCategory(cat),
    }))
  );

  // For each category, fetch clicks in batches of 10 concurrent requests
  for (const { category, links } of linkIdsByCategory) {
    if (links.length === 0) {
      result.set(category, []);
      continue;
    }

    const byDate = new Map<string, number>();
    const BATCH_SIZE = 5;

    for (let i = 0; i < links.length; i += BATCH_SIZE) {
      const batch = links.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((id) => fetchDailyClicks(id, days).catch((err) => {
          console.warn(`Bitly fetch failed for ${id}:`, err);
          return [] as ClicksByDay[];
        }))
      );

      for (const linkClicks of batchResults) {
        for (const entry of linkClicks) {
          const date = entry.date.slice(0, 10);
          byDate.set(date, (byDate.get(date) || 0) + entry.clicks);
        }
      }

      // Throttle between batches to avoid Bitly rate limits
      if (i + BATCH_SIZE < links.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const rows: DailyClickRow[] = Array.from(byDate.entries())
      .map(([date, clicks]) => ({ date, clicks }))
      .sort((a, b) => a.date.localeCompare(b.date));

    result.set(category, rows);
  }

  return result;
}

/**
 * Per-video Bitly click attribution: matches videos published in the date range
 * (from liam_videos) to bitly_links via normalized title, then fetches click counts
 * for those specific links — filtered to the same date range.
 *
 * Returns aggregate totals plus a per-video breakdown so the cockpit can show:
 *   - a "from this period's videos" line (aggregate)
 *   - eventually, a hover/drill-down with each video's own contribution
 */

export interface VideoBitlyAttribution {
  videoTitle: string;
  publishedAt: string;
  ytSkoolClicks: number;
  ytWebsiteClicks: number;
}

export interface PerVideoClicksResult {
  ytToSkool: number;
  ytToWebsite: number;
  videos: VideoBitlyAttribution[];
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function getPerVideoClicks(
  startDate: string,
  endDate: string
): Promise<PerVideoClicksResult> {
  if (!startDate || !endDate) return { ytToSkool: 0, ytToWebsite: 0, videos: [] };
  const headers = await getSupabaseHeaders();

  // 1. Fetch all yt-* bitly links (bitly_shortlink, content_title, category)
  const linksRes = await fetch(
    `${SUPABASE_URL}/rest/v1/bitly_links?select=bitly_shortlink,content_title,category&category=in.(yt-skool,yt-accelerator)`,
    { headers }
  );
  if (!linksRes.ok) return { ytToSkool: 0, ytToWebsite: 0, videos: [] };
  const links: { bitly_shortlink: string; content_title: string | null; category: string }[] =
    await linksRes.json();

  // 2. Fetch videos published within the range (end-date inclusive via lt of next day)
  const endNext = new Date(Date.parse(endDate + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
  const videosRes = await fetch(
    `${SUPABASE_URL}/rest/v1/liam_videos?select=video_title,published_at&published_at=gte.${startDate}&published_at=lt.${endNext}`,
    { headers }
  );
  if (!videosRes.ok) return { ytToSkool: 0, ytToWebsite: 0, videos: [] };
  const videos: { video_title: string; published_at: string }[] = await videosRes.json();

  if (videos.length === 0 || links.length === 0) {
    return { ytToSkool: 0, ytToWebsite: 0, videos: [] };
  }

  // 3. Index links by normalized content_title
  const linkIndex = new Map<string, typeof links>();
  for (const l of links) {
    if (!l.content_title) continue;
    const key = normalizeTitle(l.content_title);
    if (!key) continue;
    if (!linkIndex.has(key)) linkIndex.set(key, []);
    linkIndex.get(key)!.push(l);
  }

  // 4. Match each video to its bitly links (exact normalized match → fallback substring match)
  const matched: { bitly: string; category: string; videoTitle: string; publishedAt: string }[] = [];
  for (const v of videos) {
    const normVideo = normalizeTitle(v.video_title);
    let videoLinks = linkIndex.get(normVideo) ?? [];
    if (videoLinks.length === 0) {
      // Fallback: find an indexed key that's a meaningful substring of the video title
      // (or vice versa). Min length 12 to avoid spurious matches on short keys.
      for (const [k, ls] of linkIndex.entries()) {
        if (k.length >= 12 && (normVideo.includes(k) || k.includes(normVideo))) {
          videoLinks = ls;
          break;
        }
      }
    }
    for (const l of videoLinks) {
      matched.push({
        bitly: l.bitly_shortlink,
        category: l.category,
        videoTitle: v.video_title,
        publishedAt: v.published_at,
      });
    }
  }

  if (matched.length === 0) return { ytToSkool: 0, ytToWebsite: 0, videos: [] };

  // 5. Pull click data from Bitly for each matched link, filter to range, batch+throttle
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.max(1, Math.ceil(
    (Date.parse(today + "T00:00:00Z") - Date.parse(startDate + "T00:00:00Z")) / 86400000
  ) + 1);

  const BATCH_SIZE = 5;
  const perLink: { bitly: string; clicks: number; category: string; videoTitle: string; publishedAt: string }[] = [];
  for (let i = 0; i < matched.length; i += BATCH_SIZE) {
    const batch = matched.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (m) => {
        const linkClicks = await fetchDailyClicks(m.bitly, days).catch(() => [] as ClicksByDay[]);
        const total = linkClicks
          .filter((c) => {
            const d = c.date.slice(0, 10);
            return d >= startDate && d <= endDate;
          })
          .reduce((s, c) => s + c.clicks, 0);
        return { bitly: m.bitly, clicks: total, category: m.category, videoTitle: m.videoTitle, publishedAt: m.publishedAt };
      })
    );
    perLink.push(...batchResults);
    if (i + BATCH_SIZE < matched.length) await new Promise((r) => setTimeout(r, 300));
  }

  // 6. Aggregate by video + grand totals
  const videoMap = new Map<string, VideoBitlyAttribution>();
  let ytToSkool = 0;
  let ytToWebsite = 0;
  for (const r of perLink) {
    if (r.clicks === 0) continue;
    if (!videoMap.has(r.videoTitle)) {
      videoMap.set(r.videoTitle, {
        videoTitle: r.videoTitle,
        publishedAt: r.publishedAt,
        ytSkoolClicks: 0,
        ytWebsiteClicks: 0,
      });
    }
    const va = videoMap.get(r.videoTitle)!;
    if (r.category === "yt-skool") {
      va.ytSkoolClicks += r.clicks;
      ytToSkool += r.clicks;
    } else if (r.category === "yt-accelerator") {
      va.ytWebsiteClicks += r.clicks;
      ytToWebsite += r.clicks;
    }
  }

  return {
    ytToSkool,
    ytToWebsite,
    videos: [...videoMap.values()].sort(
      (a, b) => b.ytSkoolClicks + b.ytWebsiteClicks - (a.ytSkoolClicks + a.ytWebsiteClicks)
    ),
  };
}

/**
 * Buckets daily click data into weekly totals based on week boundaries.
 */
export function bucketClicksByWeek(
  rows: DailyClickRow[],
  weekConfigs: { start: string; end: string }[]
): (number | "—")[] {
  return bucketByWeek(rows, weekConfigs, (r) => r.clicks);
}
