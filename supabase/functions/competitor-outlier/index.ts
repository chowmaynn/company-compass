// Supabase Edge Function: Competitor Outlier Detection
// Called by competitor-daily for videos aged 3+ days.
// Checks if a video is an outlier vs channel historical performance,
// and if so, runs AI comment analysis and flags it on competitor_videos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchYouTubeComments, analyzeComments } from "../_shared/youtube.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DAY_COLUMNS: Record<number, string> = {
  3: "views_day_3",
  5: "views_day_5",
  7: "views_day_7",
  10: "views_day_10",
  14: "views_day_14",
};

function computeMedianOutlier(
  historicalViews: number[],
  currentViews: number
): { typicalMedian: number; isOutlier: boolean } {
  if (historicalViews.length === 0) return { typicalMedian: 0, isOutlier: false };

  const sorted = [...historicalViews].sort((a, b) => a - b);
  const trimCount = Math.floor(sorted.length * 0.1);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount || undefined);
  if (trimmed.length === 0) return { typicalMedian: 0, isOutlier: false };

  const mid = Math.floor(trimmed.length / 2);
  const typicalMedian =
    trimmed.length % 2 === 0 ? (trimmed[mid - 1] + trimmed[mid]) / 2 : trimmed[mid];

  return { typicalMedian, isOutlier: currentViews > typicalMedian * 1.2 };
}

Deno.serve(async (req) => {
  try {
    const { videoID, days_since_published, likes_num, comments_num, duration_minutes } =
      await req.json();

    const dayKeys = [3, 5, 7, 10, 14];
    const closestDay = dayKeys.reduce((prev, curr) =>
      Math.abs(curr - days_since_published) < Math.abs(prev - days_since_published) ? curr : prev
    );
    const dayColumn = DAY_COLUMNS[closestDay];
    if (!dayColumn) {
      return new Response(JSON.stringify({ skipped: true, reason: "no matching day column" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Get the video row
    const { data: video, error: videoErr } = await supabase
      .from("competitor_videos")
      .select("*")
      .eq("id", videoID)
      .single();

    if (videoErr || !video) {
      return new Response(JSON.stringify({ error: "Video not found" }), { status: 404 });
    }

    // 2. Skip if already flagged as outlier
    if (video.is_outlier) {
      return new Response(JSON.stringify({ skipped: true, reason: "already flagged" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Fetch historical views for same channel at same age
    const { data: historical } = await supabase
      .from("competitor_videos")
      .select(`id, ${dayColumn}`)
      .eq("competitorchannel_id", video.competitorchannel_id)
      .gt(dayColumn, 0)
      .neq("id", videoID)
      .limit(50);

    const historicalViews = (historical || [])
      .map((h: any) => h[dayColumn])
      .filter((v: any) => typeof v === "number" && v > 0);

    const currentViews = video[dayColumn] || video.views || 0;
    const { typicalMedian, isOutlier } = computeMedianOutlier(historicalViews, currentViews);

    if (!isOutlier) {
      return new Response(
        JSON.stringify({ isOutlier: false, currentViews, typicalMedian }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Fetch and analyze comments
    const ytComments = await fetchYouTubeComments(video.video_id, YOUTUBE_API_KEY);
    const analysis = await analyzeComments(ytComments, OPENAI_API_KEY);

    // 5. Update the video row with outlier flag + analysis
    const { error: updateErr } = await supabase
      .from("competitor_videos")
      .update({
        is_outlier: true,
        comments_summary: analysis,
        likes: likes_num,
        comments: comments_num,
        duration_minutes: duration_minutes,
      })
      .eq("id", videoID);

    if (updateErr) {
      console.error("Failed to update video:", updateErr.message);
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });
    }

    return new Response(
      JSON.stringify({ isOutlier: true, currentViews, typicalMedian }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Outlier function error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
