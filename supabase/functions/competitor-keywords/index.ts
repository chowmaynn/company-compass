// Supabase Edge Function: Competitor Keyword Search
// Called by competitor-daily on Sundays.
// Searches YouTube for trending videos matching niche keywords,
// checks engagement thresholds, and saves qualifying ideas.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const OWN_CHANNEL_ID = "UCui4jxDaMb53Gdh-AZUTPAg";
const KEYWORDS = "AI|automation|agency|business|entrepreneurship|automate";
const REGION = "US";

// Regex patterns for non-Latin scripts
const FOREIGN_REGEX =
  /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u0370-\u03FF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/;

function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const mins = parseInt(match[2] || "0");
  const secs = parseInt(match[3] || "0");
  return hours * 60 + mins + secs / 60;
}

async function searchYouTube(
  keywords: string,
  videoDuration: "long" | "medium",
  publishedAfter: string
): Promise<any[]> {
  const params = new URLSearchParams({
    part: "snippet",
    regionCode: REGION,
    maxResults: "50",
    type: "video",
    publishedAfter,
    order: "viewCount",
    q: keywords,
    videoDuration,
    relevanceLanguage: "en",
    videoCategoryId: "27",
    key: YOUTUBE_API_KEY,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) {
    console.error(`YouTube search error (${videoDuration}):`, res.status);
    return [];
  }
  const data = await res.json();
  return data.items || [];
}

async function getVideoDetails(videoIds: string[]): Promise<any[]> {
  if (videoIds.length === 0) return [];
  const params = new URLSearchParams({
    part: "snippet,statistics,contentDetails",
    id: videoIds.join(","),
    key: YOUTUBE_API_KEY,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.items || [];
}

async function getChannelStats(channelIds: string[]): Promise<Map<string, number>> {
  if (channelIds.length === 0) return new Map();
  const params = new URLSearchParams({
    part: "statistics",
    id: channelIds.join(","),
    key: YOUTUBE_API_KEY,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`);
  if (!res.ok) return new Map();
  const data = await res.json();
  const map = new Map<string, number>();
  for (const ch of data.items || []) {
    map.set(ch.id, parseInt(ch.statistics.subscriberCount || "0"));
  }
  return map;
}

async function checkNicheFit(title: string): Promise<boolean> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You evaluate if a YouTube video title fits the niche of: AI, business automation, service businesses, AI agencies, entrepreneurship, making money with AI.

Exclude:
- Country/place-specific ideas
- Crypto-related content
- Pure news/current events videos
- Vlogs
- Online sessions/presentations/recorded speeches
- Gaming or entertainment

Return ONLY a JSON object: {"reasoning": "brief reason", "keep": true/false}`,
        },
        { role: "user", content: title },
      ],
    }),
  });

  if (!res.ok) return false;
  const data = await res.json();
  try {
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    return parsed.keep === true;
  } catch {
    return false;
  }
}

async function fetchYouTubeComments(videoId: string): Promise<string[]> {
  const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&order=relevance&maxResults=50&key=${YOUTUBE_API_KEY}`;
  const res = await fetch(url);
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

  const commentText = comments.slice(0, 30).join("\n---\n");
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
Analyze these comments and return a JSON object with exactly these keys:
- "sentiment": overall sentiment of the audience (1-2 sentences)
- "pain_points": key pain points or problems viewers mention (comma-separated list)
- "what_resonated": what viewers liked or found valuable (comma-separated list)

Return ONLY valid JSON, no markdown.`,
        },
        { role: "user", content: commentText },
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
    // 1. Get known competitor channel IDs to exclude
    const { data: knownChannels } = await supabase
      .from("competitor_channels")
      .select("channel_id");
    const excludeChannelIds = new Set(
      (knownChannels || []).map((c: any) => c.channel_id).filter(Boolean)
    );
    excludeChannelIds.add(OWN_CHANNEL_ID);

    // 2. Search YouTube (long + medium videos from past week)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [longResults, mediumResults] = await Promise.all([
      searchYouTube(KEYWORDS, "long", oneWeekAgo),
      searchYouTube(KEYWORDS, "medium", oneWeekAgo),
    ]);

    // 3. Deduplicate
    const seen = new Set<string>();
    const allResults: any[] = [];
    for (const item of [...longResults, ...mediumResults]) {
      const vid = item.id?.videoId;
      if (vid && !seen.has(vid)) {
        seen.add(vid);
        allResults.push(item);
      }
    }
    logs.push(`Found ${allResults.length} unique videos from keyword search`);

    // 4. Filter non-English titles
    const englishResults = allResults.filter(
      (item) => !FOREIGN_REGEX.test(item.snippet?.title || "")
    );
    logs.push(`${englishResults.length} after English filter`);

    // 5. Get video details in batches
    const videoIds = englishResults.map((r) => r.id.videoId);
    const videoDetails: any[] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const batch = await getVideoDetails(videoIds.slice(i, i + 50));
      videoDetails.push(...batch);
    }

    // 6. Filter out competitor channels and own channel
    const filtered = videoDetails.filter(
      (v) => !excludeChannelIds.has(v.snippet.channelId)
    );
    logs.push(`${filtered.length} after excluding known channels`);

    // 7. Get channel subscriber counts
    const channelIds = [...new Set(filtered.map((v) => v.snippet.channelId))];
    const subsMap = await getChannelStats(channelIds);

    // 8. Process each video
    let savedCount = 0;
    for (const video of filtered) {
      const views = parseInt(video.statistics?.viewCount || "0");
      const likes = parseInt(video.statistics?.likeCount || "0");
      const commentCount = parseInt(video.statistics?.commentCount || "0");
      const subs = subsMap.get(video.snippet.channelId) || 1;
      const duration = parseISO8601Duration(video.contentDetails?.duration || "");

      // Engagement filters
      const viewsToSubs = views / subs;
      const engagementRate = (likes + commentCount) / Math.max(views, 1);

      if (viewsToSubs < 0.15 && engagementRate < 0.05) continue;

      // AI niche fit check
      const fits = await checkNicheFit(video.snippet.title);
      if (!fits) continue;

      // Check if already in competitor_videos
      const { data: existing } = await supabase
        .from("competitor_videos")
        .select("id")
        .eq("video_id", video.id)
        .maybeSingle();

      if (existing) continue;

      // Fetch comments & analyze
      const comments = await fetchYouTubeComments(video.id);
      const analysis = await analyzeComments(comments);

      // Save to competitor_videos as an outlier discovery
      const { error: insertErr } = await supabase.from("competitor_videos").insert({
        video_id: video.id,
        video_title: video.snippet.title,
        video_thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
        published_at: video.snippet.publishedAt,
        channel_name: video.snippet.channelTitle,
        views,
        likes,
        comments: commentCount,
        comments_summary: analysis,
        duration_minutes: Math.round(duration),
        is_outlier: true,
      });

      if (insertErr) {
        logs.push(`Insert error for ${video.id}: ${insertErr.message}`);
      } else {
        savedCount++;
      }
    }

    logs.push(`Saved ${savedCount} new outlier videos from keyword search`);

    return new Response(JSON.stringify({ success: true, logs }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Keyword search error:", err);
    return new Response(JSON.stringify({ error: String(err), logs }), { status: 500 });
  }
});
