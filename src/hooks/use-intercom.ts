import { useQuery } from "@tanstack/react-query";
import {
  fetchAdminMe,
  fetchRecentConversations,
  fetchYourInboxConversations,
  type IntercomConversation,
} from "@/lib/intercom";

export type { IntercomConversation };

export interface IntercomData {
  recent: IntercomConversation[];
  recentTotal: number;
  inbox: IntercomConversation[];
  inboxTotal: number;
  loading: boolean;
  error: string | null;
}

async function fetchIntercomData(days: number) {
  const admin = await fetchAdminMe();
  const adminId = admin?.id ?? "";

  const [r, i] = await Promise.all([
    fetchRecentConversations(days, adminId || undefined),
    adminId
      ? fetchYourInboxConversations(adminId)
      : Promise.resolve({ conversations: [] as IntercomConversation[], total_count: 0 }),
  ]);

  return {
    recent: r.conversations,
    recentTotal: r.total_count,
    inbox: i.conversations,
    inboxTotal: i.total_count,
  };
}

export function useIntercom(days = 30): IntercomData {
  const query = useQuery({
    queryKey: ["intercom", "conversations", days],
    queryFn: () => fetchIntercomData(days),
    staleTime: 5 * 60 * 1000,
  });

  return {
    recent: query.data?.recent ?? [],
    recentTotal: query.data?.recentTotal ?? 0,
    inbox: query.data?.inbox ?? [],
    inboxTotal: query.data?.inboxTotal ?? 0,
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
  };
}
