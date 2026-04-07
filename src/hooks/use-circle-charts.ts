import { useQuery } from "@tanstack/react-query";

const BASE = "/api/circle/admin/v2";

async function circleFetch(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Circle API ${res.status}`);
  return res.json();
}

// Fetch multiple pages and combine records
async function fetchAllPages(path: string, pages: number) {
  const separator = path.includes("?") ? "&" : "?";
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      circleFetch(`${path}${separator}page=${i + 1}&per_page=100`)
    )
  );
  return results.flatMap((r) => r.records ?? []);
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface SpaceCount {
  name: string;
  count: number;
}

export interface TopPost {
  name: string;
  likes: number;
  comments: number;
  space: string;
  url: string;
}

export interface ActivityBucket {
  label: string;
  count: number;
}

function groupByDay(records: { created_at: string }[]): DailyCount[] {
  const map: Record<string, number> = {};
  records.forEach((r) => {
    const day = r.created_at.slice(0, 10);
    map[day] = (map[day] || 0) + 1;
  });
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

function last30Days(daily: DailyCount[]): DailyCount[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return daily.filter((d) => d.date >= cutoffStr);
}

export function useCircleCharts() {
  // Member growth — 3 pages = up to 300 members
  const membersQuery = useQuery({
    queryKey: ["circle-charts", "members"],
    queryFn: () => fetchAllPages("/community_members?sort=latest", 3),
    staleTime: 10 * 60 * 1000,
  });

  // Post activity — 3 pages = up to 300 posts
  const postsQuery = useQuery({
    queryKey: ["circle-charts", "posts"],
    queryFn: () => fetchAllPages("/posts?sort=latest", 3),
    staleTime: 10 * 60 * 1000,
  });

  // Top posts by engagement
  const topPostsQuery = useQuery({
    queryKey: ["circle-charts", "top-posts"],
    queryFn: () => circleFetch("/posts?per_page=20&sort=likes_count"),
    staleTime: 10 * 60 * 1000,
  });

  const isLoading = membersQuery.isLoading || postsQuery.isLoading || topPostsQuery.isLoading;
  const isError = membersQuery.isError || postsQuery.isError || topPostsQuery.isError;

  // Member growth — daily new members (last 30 days)
  const memberGrowth: DailyCount[] = membersQuery.data
    ? last30Days(groupByDay(membersQuery.data))
    : [];

  // Daily post activity (last 30 days)
  const postActivity: DailyCount[] = postsQuery.data
    ? last30Days(groupByDay(postsQuery.data))
    : [];

  // Space activity from recent posts
  const spaceActivity: SpaceCount[] = (() => {
    if (!postsQuery.data) return [];
    const map: Record<string, number> = {};
    postsQuery.data.forEach((p: { space_name?: string }) => {
      const name = p.space_name || "Unknown";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  })();

  // Top engaged posts (likes + comments)
  const topPosts: TopPost[] = topPostsQuery.data?.records
    ? topPostsQuery.data.records
        .map((p: { name: string; likes_count: number; comments_count: number; space_name: string; url: string }) => ({
          name: p.name?.length > 40 ? p.name.slice(0, 40) + "…" : p.name,
          likes: p.likes_count || 0,
          comments: p.comments_count || 0,
          space: p.space_name,
          url: p.url,
        }))
        .filter((p: TopPost) => p.likes + p.comments > 0)
        .slice(0, 10)
    : [];

  // Member activity buckets — based on last_seen_at
  const activityBuckets: ActivityBucket[] = (() => {
    if (!membersQuery.data) return [];
    const now = new Date();
    const buckets = { "Last 7 days": 0, "8–14 days": 0, "15–30 days": 0, "30+ days": 0 };
    membersQuery.data.forEach((m: { last_seen_at?: string }) => {
      if (!m.last_seen_at) return;
      const days = (now.getTime() - new Date(m.last_seen_at).getTime()) / 86400000;
      if (days <= 7) buckets["Last 7 days"]++;
      else if (days <= 14) buckets["8–14 days"]++;
      else if (days <= 30) buckets["15–30 days"]++;
      else buckets["30+ days"]++;
    });
    return Object.entries(buckets).map(([label, count]) => ({ label, count }));
  })();

  // Raw posts for client-side filtering
  const rawPosts: { name: string; likes_count: number; comments_count: number; space_name: string; url: string; created_at: string }[] =
    postsQuery.data ?? [];

  return {
    memberGrowth,
    postActivity,
    spaceActivity,
    topPosts,
    activityBuckets,
    rawPosts,
    isLoading,
    isError,
  };
}
