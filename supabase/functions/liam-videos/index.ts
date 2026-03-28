// Supabase Edge Function: Liam Ottley Channel Videos
// Fetches recent videos from Liam's channel, stores them in liam_videos,
// and runs OpenAI comment analysis on new videos.
// Triggered daily by pg_cron (after competitor-daily).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseISO8601Duration, fetchYouTubeComments, analyzeComments, LIAM_CHANNEL_ID } from "../_shared/youtube.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CHANNEL_ID = LIAM_CHANNEL_ID;

async function searchChannelVideos(publishedAfter: string): Promise<string[]> {
  const params = new URLSearchParams({
    part: "id",
    channelId: CHANNEL_ID,
    maxResults: "50",
    order: "date",
    publishedAfter,
    type: "video",
    key: YOUTUBE_API_KEY,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((item: any) => item.id.videoId).filter(Boolean);
}

async function getVideoDetails(videoIds: string[]): Promise<any[]> {
  if (videoIds.length === 0) return [];
  const allVideos: any[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: "snippet,statistics,contentDetails",
      id: batch.join(","),
      key: YOUTUBE_API_KEY,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!res.ok) continue;
    const data = await res.json();
    allVideos.push(...(data.items || []));
  }
  return allVideos;
}

Deno.serve(async (req) => {
  const logs: string[] = [];

  try {
    // Check for backfill mode
    let backfill = false;
    try {
      const body = await req.json();
      backfill = body?.backfill === true;
    } catch { /* no body or not JSON */ }

    // Backfill: analyze comments for all videos missing comments_summary
    if (backfill) {
      const { data: missing } = await supabase
        .from("liam_videos")
        .select("id, video_id, comments")
        .is("comments_summary", null)
        .gt("comments", 0)
        .order("published_at", { ascending: false });

      if (!missing || missing.length === 0) {
        return new Response(JSON.stringify({ success: true, logs: ["No videos need comment analysis"] }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      logs.push(`Backfilling comment analysis for ${missing.length} videos`);
      let analyzed = 0;

      for (const video of missing) {
        const ytComments = await fetchYouTubeComments(video.video_id, YOUTUBE_API_KEY);
        const analysis = await analyzeComments(ytComments, OPENAI_API_KEY);
        if (analysis) {
          await supabase.from("liam_videos").update({ comments_summary: analysis }).eq("id", video.id);
          analyzed++;
          logs.push(`Analyzed ${video.video_id}`);
        }
      }

      logs.push(`Backfill complete: ${analyzed}/${missing.length} analyzed`);
      return new Response(JSON.stringify({ success: true, logs }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Normal mode: Search last 30 days of videos
    const publishedAfter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const videoIds = await searchChannelVideos(publishedAfter);
    logs.push(`Found ${videoIds.length} videos from search`);

    if (videoIds.length === 0) {
      return new Response(JSON.stringify({ success: true, logs }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const videos = await getVideoDetails(videoIds);

    let newCount = 0;
    let updatedCount = 0;

    for (const video of videos) {
      const duration = parseISO8601Duration(video.contentDetails?.duration || "");
      if (duration <= 1) continue; // Skip shorts

      const views = parseInt(video.statistics?.viewCount || "0");
      const likes = parseInt(video.statistics?.likeCount || "0");
      const commentCount = parseInt(video.statistics?.commentCount || "0");
      const thumbnail =
        video.snippet.thumbnails?.high?.url ||
        video.snippet.thumbnails?.medium?.url ||
        video.snippet.thumbnails?.default?.url || "";

      // Check if exists
      const { data: existing } = await supabase
        .from("liam_videos")
        .select("id, comments_summary")
        .eq("video_id", video.id)
        .maybeSingle();

      if (existing) {
        // Update stats
        const updateData: Record<string, any> = {
          views,
          likes,
          comments: commentCount,
          video_title: video.snippet.title,
          video_thumbnail: thumbnail,
        };

        // Backfill comment analysis if missing
        if (!existing.comments_summary && commentCount > 0) {
          const ytComments = await fetchYouTubeComments(video.id, YOUTUBE_API_KEY);
          const analysis = await analyzeComments(ytComments, OPENAI_API_KEY);
          if (analysis) updateData.comments_summary = analysis;
        }

        await supabase.from("liam_videos").update(updateData).eq("id", existing.id);
        updatedCount++;
      } else {
        // New video — fetch comments and analyze
        const insertData: Record<string, any> = {
          video_id: video.id,
          video_title: video.snippet.title,
          video_thumbnail: thumbnail,
          views,
          likes,
          comments: commentCount,
          duration_minutes: Math.round(duration),
          published_at: video.snippet.publishedAt,
        };

        if (commentCount > 0) {
          const ytComments = await fetchYouTubeComments(video.id, YOUTUBE_API_KEY);
          const analysis = await analyzeComments(ytComments, OPENAI_API_KEY);
          if (analysis) insertData.comments_summary = analysis;
        }

        const { error: insertErr } = await supabase.from("liam_videos").insert(insertData);
        if (insertErr) {
          logs.push(`Insert error for ${video.id}: ${insertErr.message}`);
        } else {
          newCount++;
        }
      }
    }

    logs.push(`New: ${newCount}, Updated: ${updatedCount}`);

    // 3. Generate monthly channel summary
    try {
      const now = new Date();
      const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
      const monthStart = `${currentMonth}-01T00:00:00Z`;
      const nextMonth = now.getUTCMonth() === 11
        ? `${now.getUTCFullYear() + 1}-01-01T00:00:00Z`
        : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 2).padStart(2, "0")}-01T00:00:00Z`;

      const { data: monthVideos } = await supabase
        .from("liam_videos")
        .select("video_title, views, likes, comments, comments_summary, published_at, duration_minutes")
        .gte("published_at", monthStart)
        .lt("published_at", nextMonth)
        .not("comments_summary", "is", null)
        .order("views", { ascending: false });

      if (monthVideos && monthVideos.length >= 2) {
        const avgViews = Math.round(monthVideos.reduce((s, v) => s + (v.views || 0), 0) / monthVideos.length);

        const videoBriefs = monthVideos.map((v: any) => {
          const cs = typeof v.comments_summary === "string"
            ? JSON.parse(v.comments_summary)
            : v.comments_summary;
          return `- "${v.video_title}" (${v.views} views, ${v.likes} likes, ${v.comments} comments, ${v.duration_minutes}m)
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
                content: `You analyze a YouTube channel's own video performance for the month. This is "Liam Ottley's" channel about AI automation agencies and business.

Given the channel's videos with performance metrics and comment analysis, produce a strategic summary of what's working and what the audience wants.

Return ONLY a JSON object with these keys:
- "performance_insights": array of 3-5 observations about which videos performed best/worst and why
- "audience_wants": array of 5-8 topics/questions the audience is most interested in (derived from comments)
- "pain_points": array of 5-8 audience pain points identified across all videos
- "what_worked": array of 5-8 content elements that resonated (formats, topics, hooks)
- "title_analysis": array of 4-6 observations about which title patterns drove the most views
- "recommendations": array of 3-5 actionable content recommendations for next month

Return ONLY valid JSON, no markdown.`,
              },
              { role: "user", content: `Here are ${monthVideos.length} videos from ${currentMonth} (avg ${avgViews} views):\n\n${videoBriefs}` },
            ],
          }),
        });

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          const summaryContent = summaryData.choices?.[0]?.message?.content;
          if (summaryContent) {
            const parsed = JSON.parse(summaryContent);
            await supabase.from("channel_summaries").upsert({
              month: currentMonth,
              total_videos: monthVideos.length,
              outlier_count: 0, // calculated on frontend
              avg_views: avgViews,
              summary: parsed,
            }, { onConflict: "month" });
            logs.push(`Generated channel summary for ${currentMonth}`);
          }
        }
      } else {
        logs.push("Skipped channel summary — not enough videos with analysis");
      }
    } catch (sumErr) {
      logs.push(`Channel summary error: ${String(sumErr)}`);
    }

    return new Response(JSON.stringify({ success: true, logs }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Liam videos error:", err);
    return new Response(JSON.stringify({ error: String(err), logs }), { status: 500 });
  }
});
