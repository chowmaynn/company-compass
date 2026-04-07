// Supabase Edge Function: Bitly Daily Click Aggregation
// Runs daily at 12:01am NZT via pg_cron.
// Fetches link IDs from bitly_links table, pulls daily clicks from Bitly API,
// aggregates by category, and writes weekly totals to the scorecard table.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BITLY_TOKEN = Deno.env.get("BITLY_TOKEN")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BITLY_BASE = "https://api-ssl.bitly.com/v4";

// NZ timezone offset: NZDT = UTC+13 (Oct–Apr), NZST = UTC+12 (Apr–Sep)
// We approximate by checking if the month is in daylight saving range
function nzOffsetHours(date: Date): number {
  const m = date.getUTCMonth(); // 0-indexed
  // NZDT: last Sunday in Sep → first Sunday in Apr (roughly Oct–Mar = months 9,10,11,0,1,2,3)
  return (m >= 9 || m <= 2) ? 13 : 12;
}

/** Generate Monday-aligned week boundaries for the current month in NZ time.
 *  W1-W3: Mon-Sun (7 days). W4: 4th Monday to end of month. */
function generateWeekConfigs() {
  const now = new Date();
  const offset = nzOffsetHours(now);

  const nzNow = new Date(now.getTime() + offset * 60 * 60 * 1000);
  const year = nzNow.getUTCFullYear();
  const month = nzNow.getUTCMonth(); // 0-indexed

  // Day-of-week of the 1st
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const dow = firstOfMonth.getUTCDay(); // 0=Sun
  const daysToMonday = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  const w1StartDay = 1 + daysToMonday;

  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const nzMidnightToUTC = (day: number) =>
    new Date(Date.UTC(year, month, day) - offset * 3600000);

  const configs = [];
  for (let w = 0; w < 4; w++) {
    const startDay = w1StartDay + w * 7;
    if (startDay > daysInMonth) break;
    const endDay = w < 3 ? startDay + 7 : daysInMonth + 1;

    configs.push({
      label: `W${w + 1}`,
      col: `w${w + 1}_actual`,
      start: nzMidnightToUTC(startDay).toISOString(),
      end: nzMidnightToUTC(endDay).toISOString(),
    });
  }
  return configs;
}

function getCurrentMonth(): string {
  const now = new Date();
  const offset = nzOffsetHours(now);
  const nzNow = new Date(now.getTime() + offset * 60 * 60 * 1000);
  return `${nzNow.getUTCFullYear()}-${String(nzNow.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Map bitly_links.category → scorecard metric name
const CATEGORY_TO_METRIC: Record<string, string> = {
  "yt-skool": "Clicks: YouTube > Skool",
  "yt-accelerator": "Clicks: YouTube > Accelerator",
  "skool-accelerator": "Clicks: Skool > Accelerator",
  "aios-webinar": "Clicks: Webinar",
};

// ── Helpers ───────────────────────────────────────────────────

function toNZDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}

function getCurrentWeekIndex(weekConfigs: ReturnType<typeof generateWeekConfigs>): number {
  const now = new Date();
  for (let i = 0; i < weekConfigs.length; i++) {
    if (now >= new Date(weekConfigs[i].start) && now < new Date(weekConfigs[i].end)) return i;
  }
  if (now >= new Date(weekConfigs[weekConfigs.length - 1].end)) return weekConfigs.length;
  return -1;
}

async function bitlyFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BITLY_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Bitly ${res.status}: ${url}`);
  return res.json();
}

interface ClickDay {
  date: string;
  clicks: number;
}

async function fetchDailyClicks(bitlink: string, units: number): Promise<ClickDay[]> {
  const data = await bitlyFetch<{ link_clicks: ClickDay[] }>(
    `${BITLY_BASE}/bitlinks/${bitlink}/clicks?unit=day&units=${units}`
  );
  return data.link_clicks || [];
}

// ── Main ──────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  const logs: string[] = [];

  try {
    const WEEK_CONFIGS = generateWeekConfigs();
    const CURRENT_MONTH = getCurrentMonth();

    const cwi = getCurrentWeekIndex(WEEK_CONFIGS);
    if (cwi < 0 || cwi >= WEEK_CONFIGS.length) {
      return new Response(JSON.stringify({ skipped: true, reason: "Outside active week range", month: CURRENT_MONTH, weeks: WEEK_CONFIGS }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const currentWeek = WEEK_CONFIGS[cwi];
    const weekStart = new Date(currentWeek.start);
    const daysSinceWeekStart = Math.ceil((Date.now() - weekStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    // Fetch enough days to cover the current week so far
    const daysToFetch = Math.min(daysSinceWeekStart + 1, 8);

    logs.push(`Week ${currentWeek.label}, fetching ${daysToFetch} days of Bitly clicks`);

    // 1. Get all link IDs grouped by category
    const { data: allLinks, error: linkErr } = await supabase
      .from("bitly_links")
      .select("bitly_shortlink, category");

    if (linkErr || !allLinks) {
      return new Response(JSON.stringify({ error: "Failed to fetch bitly_links" }), { status: 500 });
    }

    // Group by category
    const byCategory = new Map<string, string[]>();
    for (const link of allLinks) {
      if (!link.category || !link.bitly_shortlink) continue;
      const arr = byCategory.get(link.category) || [];
      arr.push(link.bitly_shortlink);
      byCategory.set(link.category, arr);
    }

    logs.push(`Found ${allLinks.length} links across ${byCategory.size} categories`);

    // 2. For each category, fetch clicks and aggregate for current week
    const weekStartDate = toNZDate(currentWeek.start);
    const weekEndDate = toNZDate(currentWeek.end);

    for (const [category, links] of byCategory) {
      const metricName = CATEGORY_TO_METRIC[category];
      if (!metricName) {
        logs.push(`Skipping unknown category: ${category}`);
        continue;
      }

      let weekTotal = 0;
      let processed = 0;
      let errors = 0;
      const BATCH_SIZE = 10;

      for (let i = 0; i < links.length; i += BATCH_SIZE) {
        const batch = links.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((id) => fetchDailyClicks(id, daysToFetch))
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            for (const day of result.value) {
              const date = day.date.slice(0, 10);
              if (date >= weekStartDate && date < weekEndDate) {
                weekTotal += day.clicks;
              }
            }
            processed++;
          } else {
            errors++;
          }
        }
      }

      // 3. Write to scorecard
      const { error: writeErr } = await supabase
        .from("scorecard")
        .update({
          [currentWeek.col]: String(weekTotal),
          updated_at: new Date().toISOString(),
        })
        .eq("metric", metricName)
        .eq("month", CURRENT_MONTH);

      if (writeErr) {
        logs.push(`Write error for ${metricName}: ${writeErr.message}`);
      } else {
        logs.push(`${metricName}: ${weekTotal} clicks (${processed} links, ${errors} errors) → ${currentWeek.col}`);
      }
    }

    // 4. Also compute monthly totals for each category
    for (const [category, _links] of byCategory) {
      const metricName = CATEGORY_TO_METRIC[category];
      if (!metricName) continue;

      // Read all week actuals for this metric
      const { data: row } = await supabase
        .from("scorecard")
        .select("w1_actual, w2_actual, w3_actual, w4_actual")
        .eq("metric", metricName)
        .eq("month", CURRENT_MONTH)
        .single();

      if (row) {
        const monthlyTotal = [row.w1_actual, row.w2_actual, row.w3_actual, row.w4_actual]
          .map((v) => parseInt(String(v).replace(/,/g, "")) || 0)
          .reduce((a, b) => a + b, 0);

        await supabase
          .from("scorecard")
          .update({
            monthly_actual: String(monthlyTotal),
            updated_at: new Date().toISOString(),
          })
          .eq("metric", metricName)
          .eq("month", CURRENT_MONTH);
      }
    }

    return new Response(JSON.stringify({ success: true, logs }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Bitly daily error:", err);
    return new Response(JSON.stringify({ error: String(err), logs }), { status: 500 });
  }
});
