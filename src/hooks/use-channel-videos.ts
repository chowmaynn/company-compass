import { useState, useEffect, useCallback } from "react";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

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

export function useChannelVideos() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [videos, setVideos] = useState<LiamVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const availableMonths = generateRecentMonths(6);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start, end } = getMonthBounds(month);
      const url = `${SUPABASE_URL}/rest/v1/liam_videos?published_at=gte.${start}&published_at=lt.${end}&order=published_at.desc&limit=100`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
      setVideos(await res.json());
    } catch (err) {
      console.error("Channel videos load error:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  return { videos, loading, error, month, setMonth, availableMonths };
}
