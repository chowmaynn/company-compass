// Supabase Edge Function: Competitor Comments Analysis
// Runs after competitor-daily. Processes videos missing comment analysis
// in batches, then generates the competitor insights summary.
// Separated from daily to avoid timeouts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchYouTubeComments, analyzeComments } from "../_shared/youtube.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Process at most this many videos per run to stay under time limit
const BATCH_SIZE = 10;

Deno.serve(async (_req) => {
  const logs: string[] = [];

  try {
    // 1. Find videos missing comment analysis (newest first, with comments > 0)
    const { data: videos, error: fetchErr } = await supabase
      .from("competitor_videos")
      .select("id, video_id, comments")
      .is("comments_summary", null)
      .gt("comments", 0)
      .order("published_at", { ascending: false })
      .limit(BATCH_SIZE);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
    }

    logs.push(`Found ${videos?.length ?? 0} videos needing comment analysis`);

    // 2. Process each video
    let analyzed = 0;
    for (const video of videos || []) {
      try {
        const ytComments = await fetchYouTubeComments(video.video_id, YOUTUBE_API_KEY);
        const analysis = await analyzeComments(ytComments, OPENAI_API_KEY);

        if (analysis) {
          await supabase
            .from("competitor_videos")
            .update({ comments_summary: analysis })
            .eq("id", video.id);
          analyzed++;
        }
      } catch (err) {
        logs.push(`Error analyzing video ${video.video_id}: ${String(err)}`);
      }
    }

    logs.push(`Analyzed ${analyzed} videos`);

    // 3. Generate competitor insights summary
    try {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentVideos } = await supabase
        .from("competitor_videos")
        .select("video_title, views, likes, comments, is_outlier, channel_name, comments_summary, published_at")
        .gte("published_at", fourteenDaysAgo)
        .not("comments_summary", "is", null)
        .order("views", { ascending: false })
        .limit(50);

      if (recentVideos && recentVideos.length >= 3) {
        const videoBriefs = recentVideos.map((v: any) => {
          const cs = typeof v.comments_summary === "string"
            ? JSON.parse(v.comments_summary)
            : v.comments_summary;
          return `- "${v.video_title}" by ${v.channel_name} (${v.views} views${v.is_outlier ? ", OUTLIER" : ""})
  Sentiment: ${cs?.sentiment || "N/A"}
  Pain points: ${cs?.pain_points || "N/A"}
  Resonated: ${cs?.what_resonated || "N/A"}`;
        }).join("\n\n");

        const summaryRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            temperature: 0.5,
            messages: [
              {
                role: "system",
                content: `You analyze YouTube competitor research data for an AI automation agency.
Given recent competitor videos with their performance metrics and comment analysis, produce a strategic summary.

Return ONLY a JSON object with these keys:
- "takeaways": array of 3-5 key strategic takeaways (each 1-2 sentences)
- "trending_topics": array of 5-8 trending topic keywords/phrases
- "top_pain_points": array of 5-8 audience pain points identified across videos
- "what_resonated": array of 5-8 things that resonated with audiences
- "title_analysis": array of 4-6 observations about what makes the top-performing video titles effective (hooks, formats, power words, patterns, length, emotional triggers). Compare high-view titles vs lower-view titles and identify what probably worked.

Return ONLY valid JSON, no markdown.`,
              },
              { role: "user", content: `Here are ${recentVideos.length} competitor videos from the last 14 days:\n\n${videoBriefs}` },
            ],
          }),
        });

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          const summaryContent = summaryData.choices?.[0]?.message?.content;
          if (summaryContent) {
            const parsed = JSON.parse(summaryContent);
            const periodEnd = new Date();
            const periodStart = new Date(fourteenDaysAgo);

            await supabase.from("competitor_summaries").insert({
              period_start: periodStart.toISOString(),
              period_end: periodEnd.toISOString(),
              total_videos: recentVideos.length,
              outlier_count: recentVideos.filter((v: any) => v.is_outlier).length,
              summary: parsed,
            });
            logs.push("Generated competitor insights summary");
          }
        }
      } else {
        logs.push("Skipped summary — not enough videos with comment analysis");
      }
    } catch (sumErr) {
      logs.push(`Summary generation error: ${String(sumErr)}`);
    }

    return new Response(JSON.stringify({ success: true, logs }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Comments function error:", err);
    return new Response(JSON.stringify({ error: String(err), logs }), { status: 500 });
  }
});
