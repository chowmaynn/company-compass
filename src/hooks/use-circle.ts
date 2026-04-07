import { useQuery } from "@tanstack/react-query";

const BASE = "/api/circle/admin/v2";

async function circleFetch(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Circle API ${res.status}`);
  return res.json();
}

export interface CircleEvent {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
  host: string;
  url: string;
  location_type: string;
  space: { name: string };
}

export interface CircleMember {
  id: number;
  first_name: string;
  last_name: string;
  created_at: string;
  last_seen_at: string;
  profile_url: string;
}

export function useCircle() {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const membersQuery = useQuery({
    queryKey: ["circle", "members"],
    queryFn: () => circleFetch("/community_members?per_page=100&sort=latest"),
    staleTime: 5 * 60 * 1000,
  });

  const postsQuery = useQuery({
    queryKey: ["circle", "posts"],
    queryFn: () => circleFetch("/posts?per_page=1"),
    staleTime: 5 * 60 * 1000,
  });

  const eventsQuery = useQuery({
    queryKey: ["circle", "events"],
    queryFn: () => circleFetch("/events?per_page=50&sort=starts_at&status=published"),
    staleTime: 5 * 60 * 1000,
  });

  const totalMembers: number | null = membersQuery.data?.count ?? null;

  const newMembersThisMonth: number | null = membersQuery.data?.records
    ? membersQuery.data.records.filter(
        (m: CircleMember) => new Date(m.created_at) >= new Date(startOfMonth)
      ).length
    : null;

  const recentMembers: CircleMember[] = membersQuery.data?.records?.slice(0, 5) ?? [];

  const totalPosts: number | null = postsQuery.data?.count ?? null;

  const now = new Date();
  const thirtyDaysOut = new Date(now.getTime() + 30 * 86400000);
  const upcomingEvents: CircleEvent[] = eventsQuery.data?.records
    ? eventsQuery.data.records
        .filter((e: CircleEvent) => {
          const start = new Date(e.starts_at);
          return start >= now && start <= thirtyDaysOut;
        })
        .sort((a: CircleEvent, b: CircleEvent) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
        .slice(0, 10)
    : [];

  return {
    totalMembers,
    newMembersThisMonth,
    totalPosts,
    upcomingEvents,
    recentMembers,
    isLoading: membersQuery.isLoading || postsQuery.isLoading || eventsQuery.isLoading,
    isError: membersQuery.isError || postsQuery.isError || eventsQuery.isError,
  };
}
