// Supabase Edge Function: Weekly Scorecard Snapshot
// Fetches API-sourced metrics and writes final values to the scorecard table.
// Triggered by pg_cron every Monday ~00:17 NZT.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Config from env ---
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const KIT_API_KEY = Deno.env.get("KIT_API_KEY")!;
const NOTION_API_KEY = Deno.env.get("NOTION_API_KEY")!;
const NOTION_CONTENT_DB = Deno.env.get("NOTION_CONTENT_DB")!;
const BITLY_TOKEN = Deno.env.get("BITLY_TOKEN")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Week definitions (March 2026, NZ time) ---
const WEEK_CONFIGS = [
  { label: "W1", start: "2026-03-01T11:00:00Z", end: "2026-03-08T11:00:00Z" },
  { label: "W2", start: "2026-03-08T11:00:00Z", end: "2026-03-15T11:00:00Z" },
  { label: "W3", start: "2026-03-15T11:00:00Z", end: "2026-03-22T11:00:00Z" },
  { label: "W4", start: "2026-03-22T11:00:00Z", end: "2026-03-29T11:00:00Z" },
];

const CURRENT_MONTH = "2026-03";

function getCompletedWeekIndex(): number {
  const now = new Date();
  for (let i = WEEK_CONFIGS.length - 1; i >= 0; i--) {
    if (now >= new Date(WEEK_CONFIGS[i].end)) return i;
  }
  return -1;
}

// --- Supabase write helper ---
async function writeMetric(metric: string, column: string, value: string): Promise<boolean> {
  const { error } = await supabase
    .from("scorecard")
    .update({ [column]: value, updated_at: new Date().toISOString() })
    .eq("metric", metric)
    .eq("month", CURRENT_MONTH);

  if (error) {
    console.error(`Failed to write ${metric}.${column}:`, error.message);
    return false;
  }
  return true;
}

// --- Kit API: Emails Sent + Email Clicks ---
async function snapshotKit(weekIndex: number, column: string): Promise<string[]> {
  const logs: string[] = [];

  try {
    // Fetch broadcasts list + bulk stats (2 calls)
    const [listRes, statsRes] = await Promise.all([
      fetch("https://api.kit.com/v4/broadcasts?per_page=500", {
        headers: { "X-Kit-Api-Key": KIT_API_KEY, Accept: "application/json" },
      }),
      fetch("https://api.kit.com/v4/broadcasts/stats?per_page=500", {
        headers: { "X-Kit-Api-Key": KIT_API_KEY, Accept: "application/json" },
      }),
    ]);

    if (!listRes.ok || !statsRes.ok) {
      logs.push(`Kit API error: list=${listRes.status}, stats=${statsRes.status}`);
      return logs;
    }

    const listData = await listRes.json();
    const statsData = await statsRes.json();

    const broadcasts: { id: number; published_at: string | null; send_at: string | null }[] = listData.broadcasts || [];
    const stats: { id: number; stats: { total_clicks: number; emails_opened: number; recipients: number } }[] = statsData.broadcasts || [];

    const statsMap = new Map(stats.map((s) => [s.id, s.stats]));
    const wc = WEEK_CONFIGS[weekIndex];
    const start = new Date(wc.start);
    const end = new Date(wc.end);

    let totalClicks = 0;
    let broadcastCount = 0;

    for (const b of broadcasts) {
      const sentAt = b.published_at || b.send_at;
      if (!sentAt) continue;
      const d = new Date(sentAt);
      if (d >= start && d < end) {
        broadcastCount++;
        const s = statsMap.get(b.id);
        if (s) totalClicks += s.total_clicks;
      }
    }

    if (broadcastCount > 0) {
      const ok1 = await writeMetric("Emails Sent", column, String(broadcastCount));
      logs.push(`Emails Sent → ${column} = ${broadcastCount} (${ok1 ? "ok" : "FAIL"})`);
    }
    if (totalClicks > 0) {
      const ok2 = await writeMetric("Email Clicks", column, String(totalClicks));
      logs.push(`Email Clicks → ${column} = ${totalClicks} (${ok2 ? "ok" : "FAIL"})`);
    }
  } catch (err) {
    logs.push(`Kit error: ${err}`);
  }

  return logs;
}

// --- Notion API: Videos published + Backlog ---
async function snapshotNotion(weekIndex: number, column: string): Promise<string[]> {
  const logs: string[] = [];
  const headers = {
    Authorization: `Bearer ${NOTION_API_KEY}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
  };

  try {
    // Published count for the completed week
    const wc = WEEK_CONFIGS[weekIndex];
    const startDate = wc.start.split("T")[0];
    const endDate = wc.end.split("T")[0];

    const publishedRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONTENT_DB}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        filter: {
          and: [
            { property: "Status", status: { equals: "Published" } },
            { property: "Publish Date", date: { on_or_after: startDate } },
            { property: "Publish Date", date: { before: endDate } },
          ],
        },
      }),
    });

    if (publishedRes.ok) {
      const data = await publishedRes.json();
      const count = data.results?.length ?? 0;
      const ok = await writeMetric("Videos posted last week", column, String(count));
      logs.push(`Videos posted last week → ${column} = ${count} (${ok ? "ok" : "FAIL"})`);
    } else {
      logs.push(`Notion published query error: ${publishedRes.status}`);
    }

    // Backlog count (current snapshot)
    const backlogStatuses = [
      "Filmed", "Uploaded", "Create Resource", "Transcription Added",
      "Generate Images", "Images Ready", "Generate Icons", "Icons Ready",
      "Generate Videos", "Generations Ready", "Editing Draft", "Review Draft",
      "Feedback on Draft", "Editing Final", "Review Final", "Feedback on Final",
      "Ready to Publish ⌛️",
    ];

    const backlogRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONTENT_DB}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        filter: {
          or: backlogStatuses.map((s) => ({ property: "Status", status: { equals: s } })),
        },
      }),
    });

    if (backlogRes.ok) {
      const data = await backlogRes.json();
      const count = data.results?.length ?? 0;
      const ok = await writeMetric("Videos in the backlog", column, String(count));
      logs.push(`Videos in the backlog → ${column} = ${count} (${ok ? "ok" : "FAIL"})`);
    } else {
      logs.push(`Notion backlog query error: ${backlogRes.status}`);
    }
  } catch (err) {
    logs.push(`Notion error: ${err}`);
  }

  return logs;
}

// --- Bitly API: Click categories ---
async function snapshotBitly(weekIndex: number, column: string): Promise<string[]> {
  const logs: string[] = [];

  const categories: Record<string, { metric: string; links: string[] }> = {
    "skool-accelerator": {
      metric: "Bitly clicks: Skool > Accelerator",
      links: [
        "bit.ly/Consultant-Fast-Lane-Accelerator",
        "bit.ly/Builder-Fast-Lane-Accelerator",
        "bit.ly/Accelerator-Alignment",
        "bit.ly/sk-success-accelerator",
      ],
    },
    // Add yt-skool and yt-accelerator when link IDs are configured
  };

  const wc = WEEK_CONFIGS[weekIndex];
  const startDate = wc.start.split("T")[0];
  const endDate = wc.end.split("T")[0];

  for (const [_cat, { metric, links }] of Object.entries(categories)) {
    try {
      let totalClicks = 0;

      for (const link of links) {
        const res = await fetch(
          `https://api-ssl.bitly.com/v4/bitlinks/${link}/clicks?unit=day&units=31`,
          { headers: { Authorization: `Bearer ${BITLY_TOKEN}` } }
        );

        if (!res.ok) {
          logs.push(`Bitly error for ${link}: ${res.status}`);
          continue;
        }

        const data = await res.json();
        for (const entry of data.link_clicks || []) {
          const date = entry.date.slice(0, 10);
          if (date >= startDate && date < endDate) {
            totalClicks += entry.clicks;
          }
        }
      }

      if (totalClicks > 0) {
        const ok = await writeMetric(metric, column, String(totalClicks));
        logs.push(`${metric} → ${column} = ${totalClicks} (${ok ? "ok" : "FAIL"})`);
      }
    } catch (err) {
      logs.push(`Bitly error: ${err}`);
    }
  }

  return logs;
}

// --- Main handler ---
Deno.serve(async (req) => {
  // Allow manual trigger via POST or cron trigger
  const completedIdx = getCompletedWeekIndex();

  if (completedIdx < 0 || completedIdx >= 4) {
    return new Response(JSON.stringify({ message: "No completed week to snapshot" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const weekNum = completedIdx + 1;
  const column = `w${weekNum}_actual`;
  console.log(`[Snapshot] Snapshotting week ${weekNum} (${column})`);

  const allLogs: string[] = [];

  const [kitLogs, notionLogs, bitlyLogs] = await Promise.all([
    snapshotKit(completedIdx, column),
    snapshotNotion(completedIdx, column),
    snapshotBitly(completedIdx, column),
  ]);

  allLogs.push(...kitLogs, ...notionLogs, ...bitlyLogs);

  const result = {
    week: weekNum,
    column,
    timestamp: new Date().toISOString(),
    logs: allLogs,
  };

  console.log("[Snapshot] Complete:", JSON.stringify(result));

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
