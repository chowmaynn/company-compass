// Supabase Edge Function: Liam Ottley Channel Videos
// Fetches recent videos from Liam's channel, stores them in liam_videos,
// and runs OpenAI comment analysis on new videos.
// Triggered daily by pg_cron (after competitor-daily).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CHANNEL_ID = "UCui4jxDaMb53Gdh-AZUTPAg"; // Liam Ottley

function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || "0") * 60 + parseInt(match[2] || "0") + parseInt(match[3] || "0") / 60;
}

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

async function fetchYouTubeComments(videoId: string): Promise<string[]> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&order=relevance&maxResults=50&key=${YOUTUBE_API_KEY}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map(
    (item: any) => item.snippet.topLevelComment.snippet.textOriginal
  );
}

async function analyzeComments(
  comments: string[]
): Promise<{ sentiment: string; pain_points: string; what_resonated: string } | null> {
  if (comments.length === 0) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
          content: `You are a senior social media strategist analyzing YouTube video comments.
Return a JSON object with exactly these keys:
- "sentiment": overall sentiment (1-2 sentences)
- "pain_points": key pain points viewers mention (comma-separated)
- "what_resonated": what viewers liked or found valuable (comma-separated)

Return ONLY valid JSON, no markdown.`,
        },
        { role: "user", content: comments.slice(0, 30).join("\n---\n") },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  try {
    return JSON.parse(data.choices?.[0]?.message?.content || "null");
  } catch {
    return null;
  }
}

Deno.serve(async (_req) => {
  const logs: string[] = [];

  try {
    // Search last 30 days of videos (wider window than competitors)
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
          const ytComments = await fetchYouTubeComments(video.id);
          const analysis = await analyzeComments(ytComments);
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
          const ytComments = await fetchYouTubeComments(video.id);
          const analysis = await analyzeComments(ytComments);
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

    return new Response(JSON.stringify({ success: true, logs }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Liam videos error:", err);
    return new Response(JSON.stringify({ error: String(err), logs }), { status: 500 });
  }
});
