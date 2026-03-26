const SUPABASE_URL = import.meta.env.VITE_OPSHUB_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_OPSHUB_SUPABASE_ANON_KEY;

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// --- Types ---

export interface CompetitorChannel {
  id: number;
  channel_link: string;
  channel_id: string;
  channel_name: string;
  subscribers: number;
  video_count: number;
  total_views: number;
  channel_thumbnail: string | null;
  created_at: string;
}

export interface CompetitorVideo {
  id: number;
  competitorchannel_id: number | null;
  video_id: string;
  video_title: string;
  video_thumbnail: string;
  views: number;
  published_at: string;
  views_day_1: number | null;
  views_day_2: number | null;
  views_day_3: number | null;
  views_day_5: number | null;
  views_day_7: number | null;
  views_day_10: number | null;
  views_day_14: number | null;
  is_outlier: boolean;
  comments_summary: {
    sentiment: string;
    pain_points: string;
    what_resonated: string;
  } | null;
  likes: number | null;
  comments: number | null;
  channel_name: string | null;
  duration_minutes: number | null;
  // Joined from competitor_channels
  competitor_channels?: {
    channel_name: string;
    subscribers: number;
  };
}

export interface CompetitorSummary {
  id: number;
  period_start: string;
  period_end: string;
  total_videos: number;
  outlier_count: number;
  summary: {
    takeaways: string[];
    trending_topics: string[];
    top_pain_points: string[];
    what_resonated: string[];
    title_analysis?: string[];
  };
  created_at: string;
}

// --- Fetch functions ---

export async function fetchCompetitorChannels(): Promise<CompetitorChannel[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/competitor_channels?select=*&order=channel_name`,
    { headers }
  );
  if (!res.ok) {
    console.error("Failed to fetch competitor channels:", res.status);
    return [];
  }
  return res.json();
}

export async function fetchCompetitorVideos(
  channelId?: number,
  limit = 200
): Promise<CompetitorVideo[]> {
  let url = `${SUPABASE_URL}/rest/v1/competitor_videos?select=*,competitor_channels!competitorchannel_id(channel_name,subscribers)&order=published_at.desc&limit=${limit}`;
  if (channelId) {
    url += `&competitorchannel_id=eq.${channelId}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error("Failed to fetch competitor videos:", res.status);
    return [];
  }
  return res.json();
}

export async function fetchLatestSummary(): Promise<CompetitorSummary | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/competitor_summaries?select=*&order=created_at.desc&limit=1`,
    { headers }
  );
  if (!res.ok) {
    console.error("Failed to fetch competitor summary:", res.status);
    return null;
  }
  const rows = await res.json();
  return rows[0] || null;
}
