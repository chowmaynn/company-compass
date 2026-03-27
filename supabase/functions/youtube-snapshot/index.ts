// Supabase Edge Function: YouTube Channel Snapshot
// Runs daily via pg_cron. Captures subscriber_count, view_count, video_count
// for tracked channels and writes "New YouTube subscribers" to the scorecard.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const OWN_CHANNEL_ID = "UCui4jxDaMb53Gdh-AZUTPAg";

// NZ timezone offset
function nzOffsetHours(): number {
  const m = new Date().getUTCMonth();
  return (m >= 9 || m <= 2) ? 13 : 12;
}

function getNZDate(): string {
  const offset = nzOffsetHours();
  const nzNow = new Date(Date.now() + offset * 60 * 60 * 1000);
  return nzNow.toISOString().slice(0, 10);
}

function getCurrentMonth(): string {
  const offset = nzOffsetHours();
  const nzNow = new Date(Date.now() + offset * 60 * 60 * 1000);
  return `${nzNow.getUTCFullYear()}-${String(nzNow.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Generate 4 week boundaries for the current month in NZ time */
function generateWeekConfigs() {
  const offset = nzOffsetHours();
  const nzNow = new Date(Date.now() + offset * 60 * 60 * 1000);
  const year = nzNow.getUTCFullYear();
  const month = nzNow.getUTCMonth();
  const monthStartUTC = new Date(Date.UTC(year, month, 1) - offset * 60 * 60 * 1000);

  const configs = [];
  for (let w = 0; w < 4; w++) {
    const start = new Date(monthStartUTC.getTime() + w * 7 * 24 * 60 * 60 * 1000);
    const end = w < 3
      ? new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
      : new Date(Date.UTC(year, month + 1, 1) - offset * 60 * 60 * 1000);

    const startNZ = new Date(start.getTime() + offset * 60 * 60 * 1000);
    const endNZ = new Date(end.getTime() + offset * 60 * 60 * 1000);

    configs.push({
      label: `W${w + 1}`,
      col: `w${w + 1}_actual`,
      startDate: startNZ.toISOString().slice(0, 10),
      endDate: endNZ.toISOString().slice(0, 10),
      startUTC: start,
      endUTC: end,
    });
  }
  return configs;
}

function getCurrentWeekIndex(weekConfigs: ReturnType<typeof generateWeekConfigs>): number {
  const now = new Date();
  for (let i = 0; i < weekConfigs.length; i++) {
    if (now >= weekConfigs[i].startUTC && now < weekConfigs[i].endUTC) return i;
  }
  if (now >= weekConfigs[weekConfigs.length - 1].endUTC) return weekConfigs.length;
  return -1;
}

async function fetchChannelStats(channelId: string): Promise<{
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
} | null> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) return null;
  return {
    subscriberCount: parseInt(ch.statistics.subscriberCount || "0"),
    viewCount: parseInt(ch.statistics.viewCount || "0"),
    videoCount: parseInt(ch.statistics.videoCount || "0"),
  };
}

Deno.serve(async (_req) => {
  const logs: string[] = [];

  try {
    const today = getNZDate();
    const CURRENT_MONTH = getCurrentMonth();
    const WEEK_CONFIGS = generateWeekConfigs();
    const cwi = getCurrentWeekIndex(WEEK_CONFIGS);

    // 1. Snapshot own channel
    const stats = await fetchChannelStats(OWN_CHANNEL_ID);
    if (!stats) {
      return new Response(JSON.stringify({ error: "Failed to fetch channel stats" }), { status: 500 });
    }

    // Upsert today's snapshot
    const { error: upsertErr } = await supabase
      .from("youtube_snapshots")
      .upsert({
        channel_id: OWN_CHANNEL_ID,
        subscriber_count: stats.subscriberCount,
        view_count: stats.viewCount,
        video_count: stats.videoCount,
        snapshot_date: today,
      }, { onConflict: "channel_id,snapshot_date" });

    if (upsertErr) {
      logs.push(`Upsert error: ${upsertErr.message}`);
    } else {
      logs.push(`Snapshot saved: ${stats.subscriberCount} subs, ${stats.viewCount} views, ${stats.videoCount} videos`);
    }

    // 2. Also snapshot competitor channels (for historical tracking)
    const { data: competitors } = await supabase
      .from("competitor_channels")
      .select("channel_id")
      .not("channel_id", "is", null);

    if (competitors) {
      for (const comp of competitors) {
        const compStats = await fetchChannelStats(comp.channel_id);
        if (compStats) {
          await supabase
            .from("youtube_snapshots")
            .upsert({
              channel_id: comp.channel_id,
              subscriber_count: compStats.subscriberCount,
              view_count: compStats.viewCount,
              video_count: compStats.videoCount,
              snapshot_date: today,
            }, { onConflict: "channel_id,snapshot_date" });
        }
      }
      logs.push(`Snapshotted ${competitors.length} competitor channels`);
    }

    // 3. Calculate "New YouTube subscribers" for scorecard
    if (cwi >= 0 && cwi < WEEK_CONFIGS.length) {
      const currentWeek = WEEK_CONFIGS[cwi];

      // Get snapshot from the day before this week started (or closest earlier)
      const { data: weekStartSnapshot } = await supabase
        .from("youtube_snapshots")
        .select("subscriber_count, view_count")
        .eq("channel_id", OWN_CHANNEL_ID)
        .lte("snapshot_date", currentWeek.startDate)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .single();

      if (weekStartSnapshot) {
        const newSubs = stats.subscriberCount - weekStartSnapshot.subscriber_count;
        const newViews = stats.viewCount - weekStartSnapshot.view_count;
        logs.push(`New subs (${currentWeek.label}): ${newSubs} (${weekStartSnapshot.subscriber_count} → ${stats.subscriberCount})`);
        logs.push(`New views (${currentWeek.label}): ${newViews} (${weekStartSnapshot.view_count} → ${stats.viewCount})`);

        // Write both metrics to scorecard
        const metrics: { name: string; value: number }[] = [
          { name: "New YouTube subscribers", value: newSubs },
          { name: "YouTube views", value: newViews },
        ];

        for (const metric of metrics) {
          const { error: writeErr } = await supabase
            .from("scorecard")
            .update({
              [currentWeek.col]: String(metric.value),
              updated_at: new Date().toISOString(),
            })
            .eq("metric", metric.name)
            .eq("month", CURRENT_MONTH);

          if (writeErr) {
            logs.push(`Scorecard write error for ${metric.name}: ${writeErr.message}`);
          }

          // Update monthly total
          const { data: row } = await supabase
            .from("scorecard")
            .select("w1_actual, w2_actual, w3_actual, w4_actual")
            .eq("metric", metric.name)
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
              .eq("metric", metric.name)
              .eq("month", CURRENT_MONTH);
          }
        }
      } else {
        logs.push("No baseline snapshot found — need at least one day of history to calculate new subs/views");
      }
    }

    return new Response(JSON.stringify({ success: true, logs }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("YouTube snapshot error:", err);
    return new Response(JSON.stringify({ error: String(err), logs }), { status: 500 });
  }
});
