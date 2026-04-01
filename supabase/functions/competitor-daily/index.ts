// Supabase Edge Function: Competitor Daily Orchestrator
// Runs daily via pg_cron. Updates channel stats, discovers new videos,
// tracks view decay, triggers outlier detection, and keyword search on Sundays.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseISO8601Duration } from "../_shared/youtube.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Days we track views at
const TRACKED_DAYS = [1, 2, 3, 5, 7, 10, 14];

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function closestTrackedDay(days: number): number | null {
  // Find the tracked day that this age matches (within 0.5 day tolerance)
  for (const d of TRACKED_DAYS) {
    if (Math.abs(days - d) < 1) return d;
  }
  return null;
}

// Views decay calculation: exponential decay with r=0.7
function calculateViewsDecay(totalViews: number, daysSincePublished: number): Record<string, number> {
  const r = 0.7;
  const result: Record<string, number> = {};
  for (const day of TRACKED_DAYS) {
    if (day <= daysSincePublished) {
      // v_day = totalViews * (1 - r^day) / (1 - r^N) where N = daysSincePublished
      const projected = Math.round(totalViews * (1 - Math.pow(r, day)) / (1 - Math.pow(r, daysSincePublished)));
      result[`views_day_${day}`] = projected;
    }
  }
  return result;
}

async function resolveChannelId(channelLink: string): Promise<{
  channelId: string;
  title: string;
  subscriberCount: number;
  videoCount: number;
  totalViewCount: number;
  createdAt: string;
  country: string;
} | null> {
  // Extract handle from link like https://youtube.com/@handle
  const handleMatch = channelLink.match(/@([^/?\s]+)/);
  const channelIdMatch = channelLink.match(/\/channel\/([^/?\s]+)/);

  let url: string;
  if (handleMatch) {
    url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=${handleMatch[1]}&key=${YOUTUBE_API_KEY}`;
  } else if (channelIdMatch) {
    url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelIdMatch[1]}&key=${YOUTUBE_API_KEY}`;
  } else {
    return null;
  }

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) return null;

  return {
    channelId: ch.id,
    title: ch.snippet.title,
    subscriberCount: parseInt(ch.statistics.subscriberCount || "0"),
    videoCount: parseInt(ch.statistics.videoCount || "0"),
    totalViewCount: parseInt(ch.statistics.viewCount || "0"),
    createdAt: ch.snippet.publishedAt,
    country: ch.snippet.country || "",
  };
}

async function updateChannelStats(channelId: string): Promise<{
  subscriberCount: number;
  videoCount: number;
  totalViewCount: number;
} | null> {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const ch = data.items?.[0];
  if (!ch) return null;

  return {
    subscriberCount: parseInt(ch.statistics.subscriberCount || "0"),
    videoCount: parseInt(ch.statistics.videoCount || "0"),
    totalViewCount: parseInt(ch.statistics.viewCount || "0"),
  };
}

async function searchChannelVideos(channelId: string): Promise<string[]> {
  const publishedAfter = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    part: "id",
    channelId,
    maxResults: "50",
    order: "date",
    publishedAfter,
    type: "video",
    key: YOUTUBE_API_KEY,
  });

  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!res.ok) {
    console.error(`Search failed for channel ${channelId}:`, res.status);
    return [];
  }
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

async function invokeEdgeFunction(name: string, body: Record<string, any>): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`Failed to invoke ${name}:`, err);
  }
}

const BATCH_SIZE = 7;

Deno.serve(async (req) => {
  const logs: string[] = [];

  try {
    // Parse batch offset from request body
    let offset = 0;
    try {
      const body = await req.json();
      offset = body.offset ?? 0;
    } catch { /* no body = start from 0 */ }

    // 1. Load all competitor channels
    const { data: allChannels, error: chErr } = await supabase
      .from("competitor_channels")
      .select("*")
      .order("id");

    if (chErr || !allChannels) {
      return new Response(JSON.stringify({ error: "Failed to load channels" }), { status: 500 });
    }

    const channels = allChannels.slice(offset, offset + BATCH_SIZE);
    logs.push(`Batch offset=${offset}, processing ${channels.length} of ${allChannels.length} channels`);

    // 2. Process each channel in this batch
    for (const channel of channels) {
      try {
        // 2a. Resolve or update channel info
        if (!channel.channel_id) {
          const info = await resolveChannelId(channel.channel_link);
          if (!info) {
            logs.push(`Could not resolve channel: ${channel.channel_link}`);
            continue;
          }
          await supabase
            .from("competitor_channels")
            .update({
              channel_id: info.channelId,
              channel_name: info.title,
              subscribers: info.subscriberCount,
              video_count: info.videoCount,
              total_views: info.totalViewCount,
            })
            .eq("id", channel.id);

          channel.channel_id = info.channelId;
          logs.push(`Resolved new channel: ${info.title}`);
        } else {
          const stats = await updateChannelStats(channel.channel_id);
          if (stats) {
            await supabase
              .from("competitor_channels")
              .update({
                subscribers: stats.subscriberCount,
                video_count: stats.videoCount,
                total_views: stats.totalViewCount,
              })
              .eq("id", channel.id);
          }
        }

        // 2b. Search for recent videos
        const videoIds = await searchChannelVideos(channel.channel_id);
        if (videoIds.length === 0) continue;

        const videos = await getVideoDetails(videoIds);

        for (const video of videos) {
          const duration = parseISO8601Duration(video.contentDetails?.duration || "");
          if (duration <= 3) continue; // Filter shorts

          const views = parseInt(video.statistics?.viewCount || "0");
          const likes = parseInt(video.statistics?.likeCount || "0");
          const commentCount = parseInt(video.statistics?.commentCount || "0");
          const publishedAt = video.snippet.publishedAt;
          const age = daysSince(publishedAt);
          const trackedDay = closestTrackedDay(age);
          const thumbnail =
            video.snippet.thumbnails?.high?.url ||
            video.snippet.thumbnails?.medium?.url ||
            video.snippet.thumbnails?.default?.url || "";

          // Check if video already exists
          const { data: existing } = await supabase
            .from("competitor_videos")
            .select("id, views, comments_summary")
            .eq("video_id", video.id)
            .maybeSingle();

          if (existing) {
            // Update existing video
            const updateData: Record<string, any> = {
              views,
              likes,
              comments: commentCount,
              duration_minutes: Math.round(duration),
              video_title: video.snippet.title,
              video_thumbnail: thumbnail,
            };
            if (trackedDay) {
              updateData[`views_day_${trackedDay}`] = views;
            }

            await supabase
              .from("competitor_videos")
              .update(updateData)
              .eq("id", existing.id);

            // Trigger outlier check for videos aged 3+ days
            if (age >= 3) {
              await invokeEdgeFunction("competitor-outlier", {
                videoID: existing.id,
                days_since_published: age,
                yt_video_url: `https://www.youtube.com/watch?v=${video.id}`,
                channel_name: channel.channel_name,
                likes_num: likes,
                comments_num: commentCount,
                duration_minutes: Math.round(duration),
              });
            }
          } else {
            // Insert new video
            const insertData: Record<string, any> = {
              competitorchannel_id: channel.id,
              video_id: video.id,
              video_title: video.snippet.title,
              video_thumbnail: thumbnail,
              views,
              likes,
              comments: commentCount,
              duration_minutes: Math.round(duration),
              published_at: publishedAt,
            };

            // Set views for current tracked day
            if (trackedDay) {
              insertData[`views_day_${trackedDay}`] = views;
            }

            // For older videos (>2 days), also calculate decay for earlier days
            if (age > 2) {
              const decayValues = calculateViewsDecay(views, age);
              for (const [key, val] of Object.entries(decayValues)) {
                if (!(key in insertData)) {
                  insertData[key] = val;
                }
              }
            }

            const { data: inserted, error: insertErr } = await supabase
              .from("competitor_videos")
              .insert(insertData)
              .select("id")
              .single();

            if (insertErr) {
              logs.push(`Insert error for ${video.id}: ${insertErr.message}`);
            } else if (inserted && age >= 3) {
              // Trigger outlier check
              await invokeEdgeFunction("competitor-outlier", {
                videoID: inserted.id,
                days_since_published: age,
                yt_video_url: `https://www.youtube.com/watch?v=${video.id}`,
                channel_name: channel.channel_name,
                likes_num: likes,
                comments_num: commentCount,
                duration_minutes: Math.round(duration),
              });
            }
          }
        }

        logs.push(`Processed ${videos.length} videos for ${channel.channel_name || channel.channel_id}`);
      } catch (channelErr) {
        logs.push(`Error processing channel ${channel.id}: ${String(channelErr)}`);
      }
    }

    // 3. Chain next batch or finalize
    const nextOffset = offset + BATCH_SIZE;
    if (nextOffset < allChannels.length) {
      // More channels to process — invoke self with next offset
      await invokeEdgeFunction("competitor-daily", { offset: nextOffset });
      logs.push(`Chained next batch at offset=${nextOffset}`);
    } else {
      // Last batch — trigger follow-up tasks
      logs.push("All channels processed — triggering follow-up tasks");

      // Comment analysis
      await invokeEdgeFunction("competitor-comments", {});
      logs.push("Triggered competitor-comments");

      // On Sundays, trigger keyword search
      const today = new Date();
      if (today.getUTCDay() === 0) {
        logs.push("Sunday — triggering keyword search");
        await invokeEdgeFunction("competitor-keywords", {
          timestamp: today.toISOString(),
        });
      }
    }

    return new Response(JSON.stringify({ success: true, logs }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Daily competitor error:", err);
    return new Response(JSON.stringify({ error: String(err), logs }), { status: 500 });
  }
});
