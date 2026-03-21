const ACCESS_TOKEN = "2a5c70f0612f7fbe8baa0790acb7ce5d588bba35";
const BASE_URL = "https://api-ssl.bitly.com/v4";
const GROUP_GUID = "Bp76mCSlRsw";

interface ClicksByDay {
  date: string; // YYYY-MM-DDT00:00:00+0000
  clicks: number;
}

export type BitlyCategory = "yt-skool" | "yt-accelerator" | "skool-accelerator";

/** Known bitlink IDs by category — avoids paginating through all links to find them */
const KNOWN_LINKS: Record<BitlyCategory, string[]> = {
  "yt-skool": [],
  "yt-accelerator": [],
  "skool-accelerator": [
    "bit.ly/Consultant-Fast-Lane-Accelerator",
    "bit.ly/Builder-Fast-Lane-Accelerator",
    "bit.ly/Accelerator-Alignment",
    "bit.ly/sk-success-accelerator",
  ],
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Bitly API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Fetch daily clicks for a single bitlink over a date range */
async function fetchDailyClicks(bitlink: string, units: number): Promise<ClicksByDay[]> {
  const data = await fetchJSON<{ link_clicks: ClicksByDay[] }>(
    `${BASE_URL}/bitlinks/${bitlink}/clicks?unit=day&units=${units}`
  );
  return data.link_clicks || [];
}

export interface DailyClickRow {
  date: string; // YYYY-MM-DD
  clicks: number;
}

/**
 * Fetches all bitlinks, categorizes them, and returns aggregated daily clicks
 * for each category over the specified number of days.
 */
export async function getCategorizedClicks(
  days: number = 31
): Promise<Map<BitlyCategory, DailyClickRow[]>> {
  // Use only known/hardcoded links — no auto-discovery pagination
  const categorized = new Map<BitlyCategory, string[]>();
  for (const [cat, ids] of Object.entries(KNOWN_LINKS) as [BitlyCategory, string[]][]) {
    if (ids.length > 0) categorized.set(cat, [...ids]);
  }

  const result = new Map<BitlyCategory, DailyClickRow[]>();

  for (const [category, bitlinks] of categorized) {
    // Fetch clicks for all links in this category concurrently
    const allClicks = await Promise.all(
      bitlinks.map((id) => fetchDailyClicks(id, days))
    );

    // Aggregate clicks by date
    const byDate = new Map<string, number>();
    for (const linkClicks of allClicks) {
      for (const entry of linkClicks) {
        // Bitly returns dates like "2026-03-15T00:00:00+0000"
        const date = entry.date.slice(0, 10);
        byDate.set(date, (byDate.get(date) || 0) + entry.clicks);
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
 * Returns "—" for future weeks.
 */
export function bucketClicksByWeek(
  rows: DailyClickRow[],
  weekConfigs: { start: string; end: string }[]
): (number | "—")[] {
  const now = new Date();

  return weekConfigs.map((wc) => {
    const start = new Date(wc.start);
    if (start > now) return "—";
    // Convert week boundaries to NZ dates for comparison
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
