import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { SUPABASE_URL, getSupabaseHeaders } from "@/lib/supabase";

export interface ChannelSummary {
  id: number;
  month: string;
  total_videos: number;
  outlier_count: number;
  avg_views: number;
  summary: {
    performance_insights: string[];
    audience_wants: string[];
    pain_points: string[];
    what_worked: string[];
    title_analysis: string[];
    recommendations: string[];
  };
  created_at: string;
}

export interface LiamVideo {
  id: number;
  video_id: string;
  video_title: string;
  video_thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  duration_minutes: number | null;
  published_at: string;
  comments_summary: {
    sentiment: string;
    pain_points: string;
    what_resonated: string;
  } | null;
}

function getMonthBounds(month: string): { start: string; end: string } {
  const [year, m] = month.split("-").map(Number);
  const start = new Date(year, m - 1, 1).toISOString();
  const end = new Date(year, m, 1).toISOString();
  return { start, end };
}

function generateRecentMonths(count = 6): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

async function fetchVideosForMonth(month: string): Promise<LiamVideo[]> {
  const headers = await getSupabaseHeaders();
  const { start, end } = getMonthBounds(month);
  const url = `${SUPABASE_URL}/rest/v1/liam_videos?published_at=gte.${start}&published_at=lt.${end}&order=published_at.desc&limit=100`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
  return res.json();
}

/** Count Liam videos published within an arbitrary date range (inclusive).
 *  Same source the Content page uses — queries the `liam_videos` table via PostgREST's
 *  Prefer: count=exact header so we get the row count without pulling all rows. */
export async function fetchVideoCountInRange(startDate: string, endDate: string): Promise<number> {
  if (!startDate || !endDate) return 0;
  const headers = await getSupabaseHeaders();
  // Make end-date inclusive (the column is a date or timestamp; lt of next day captures it)
  const endNext = new Date(Date.parse(endDate + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
  const url = `${SUPABASE_URL}/rest/v1/liam_videos?published_at=gte.${startDate}&published_at=lt.${endNext}&select=id`;
  const res = await fetch(url, { headers: { ...headers, Prefer: "count=exact" } });
  if (!res.ok) return 0;
  // The row count is in the Content-Range header (e.g. "0-9/42"); fall back to JSON length.
  const range = res.headers.get("content-range");
  if (range) {
    const total = range.split("/").pop();
    if (total && total !== "*") return parseInt(total, 10);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}

async function fetchChannelSummary(month: string): Promise<ChannelSummary | null> {
  const headers = await getSupabaseHeaders();
  const url = `${SUPABASE_URL}/rest/v1/channel_summaries?month=eq.${month}&limit=1`;
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] || null;
}

export function useChannelVideos() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const availableMonths = generateRecentMonths(6);

  const query = useQuery({
    queryKey: ["channel-videos", month],
    queryFn: () => fetchVideosForMonth(month),
    staleTime: 5 * 60 * 1000,
  });

  const summaryQuery = useQuery({
    queryKey: ["channel-summary", month],
    queryFn: () => fetchChannelSummary(month),
    staleTime: 5 * 60 * 1000,
  });

  return {
    videos: query.data ?? [],
    summary: summaryQuery.data ?? null,
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
    month,
    setMonth,
    availableMonths,
  };
}
