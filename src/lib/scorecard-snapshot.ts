/**
 * Weekly scorecard snapshot: fetches final API values for a completed week
 * and writes them to Supabase as the permanent record.
 *
 * This module uses the same lib-level fetch functions as the React hooks,
 * so it works in-browser (called from a React context) or can be adapted
 * for a standalone script.
 */

import { weekConfigs, getCompletedWeekIndex } from "@/data/scorecardData";
import { updateScorecardCell } from "@/lib/supabase-scorecard";
import { fetchAllBroadcastStats } from "@/lib/kit";
import { fetchPublishedCount, fetchBacklogCount } from "@/lib/notion";
import { getCategorizedClicks, bucketClicksByWeek } from "@/lib/bitly";
// GA4 requires OAuth token — skipped in snapshot (needs manual entry or service account)

const CURRENT_MONTH = "2026-03";

interface SnapshotResult {
  metric: string;
  column: string;
  value: string;
  success: boolean;
}

/**
 * Snapshot the most recently completed week's API-sourced metrics into Supabase.
 * Returns a log of all writes attempted.
 */
export async function snapshotWeeklyApiMetrics(): Promise<SnapshotResult[]> {
  const completedIdx = getCompletedWeekIndex();
  if (completedIdx < 0 || completedIdx >= 4) {
    console.log("[Snapshot] No completed week to snapshot");
    return [];
  }

  const weekNum = completedIdx + 1;
  const column = `w${weekNum}_actual`;
  const results: SnapshotResult[] = [];

  // Helper to write a value
  async function write(metric: string, value: number | string) {
    const strVal = String(value);
    const ok = await updateScorecardCell(metric, CURRENT_MONTH, column, strVal);
    results.push({ metric, column, value: strVal, success: ok });
    console.log(`[Snapshot] ${metric} → ${column} = ${strVal} (${ok ? "ok" : "FAILED"})`);
  }

  // --- Kit: Emails Sent + Email Clicks ---
  try {
    const weekRanges = weekConfigs.map((wc) => ({ start: wc.start, end: wc.end }));
    const broadcastStats = await fetchAllBroadcastStats(weekRanges);
    const week = broadcastStats[completedIdx];
    if (week) {
      if (week.count > 0) await write("Emails Sent", week.count);
      if (week.totalClicks > 0) await write("Email Clicks", week.totalClicks);
    }
  } catch (err) {
    console.error("[Snapshot] Kit fetch failed:", err);
  }

  // --- Notion: Videos posted + Backlog ---
  try {
    const wc = weekConfigs[completedIdx];
    const startDate = wc.start.split("T")[0];
    const endDate = wc.end.split("T")[0];
    const published = await fetchPublishedCount(startDate, endDate);
    await write("Videos posted last week", published);

    const backlog = await fetchBacklogCount();
    await write("Videos in the backlog", backlog);
  } catch (err) {
    console.error("[Snapshot] Notion fetch failed:", err);
  }

  // --- Bitly: All click categories ---
  try {
    const categorized = await getCategorizedClicks(31);
    const bucketed = bucketClicksByWeek(categorized, weekConfigs);

    const bitlyMap: Record<string, string> = {
      "yt-skool": "Clicks: YouTube > Skool",
      "yt-accelerator": "Clicks: YouTube > Accelerator",
      "skool-accelerator": "Clicks: Skool > Accelerator",
    };

    for (const [category, metricName] of Object.entries(bitlyMap)) {
      const val = bucketed[category as keyof typeof bucketed]?.[completedIdx];
      if (val !== undefined && val !== "—") {
        await write(metricName, val);
      }
    }
  } catch (err) {
    console.error("[Snapshot] Bitly fetch failed:", err);
  }

  // --- GA4: Skipped (requires OAuth token, not available in cron context) ---
  // Website Views must be snapshotted manually or via a service account in the future.

  console.log(`[Snapshot] Complete: ${results.length} writes, ${results.filter(r => r.success).length} successful`);
  return results;
}
