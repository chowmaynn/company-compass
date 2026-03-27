const BITLY_TOKEN = "2a5c70f0612f7fbe8baa0790acb7ce5d588bba35";
const BITLY_BASE = "https://api-ssl.bitly.com/v4";

const SUPABASE_URL = import.meta.env.VITE_OPSHUB_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_OPSHUB_SUPABASE_ANON_KEY;

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
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/bitly_links?select=bitly_shortlink&category=eq.${category}`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
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
    const BATCH_SIZE = 10;

    for (let i = 0; i < links.length; i += BATCH_SIZE) {
      const batch = links.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((id) => fetchDailyClicks(id, days).catch(() => [] as ClicksByDay[]))
      );

      for (const linkClicks of batchResults) {
        for (const entry of linkClicks) {
          const date = entry.date.slice(0, 10);
          byDate.set(date, (byDate.get(date) || 0) + entry.clicks);
        }
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
 * Buckets daily click data into weekly totals based on week boundaries.
 */
export function bucketClicksByWeek(
  rows: DailyClickRow[],
  weekConfigs: { start: string; end: string }[]
): (number | "—")[] {
  const now = new Date();

  return weekConfigs.map((wc) => {
    const start = new Date(wc.start);
    if (start > now) return "—";
    const startDate = toNZDate(wc.start);
    const endDate = toNZDate(wc.end);
    return rows
      .filter((r) => r.date >= startDate && r.date < endDate)
      .reduce((sum, r) => sum + r.clicks, 0);
  });
}

function toNZDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}
