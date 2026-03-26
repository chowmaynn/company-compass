import { useState, useEffect } from "react";
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

export function useIntercom(days = 30): IntercomData {
  const [recent, setRecent] = useState<IntercomConversation[]>([]);
  const [recentTotal, setRecentTotal] = useState(0);
  const [inbox, setInbox] = useState<IntercomConversation[]>([]);
  const [inboxTotal, setInboxTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetchAdminMe()
      .then((admin) => {
        const adminId = admin?.id ?? "";
        return Promise.all([
          fetchRecentConversations(days, adminId || undefined),
          adminId
            ? fetchYourInboxConversations(adminId)
            : Promise.resolve({ conversations: [] as IntercomConversation[], total_count: 0 }),
        ]);
      })
      .then(([r, i]) => {
        setRecent(r.conversations);
        setRecentTotal(r.total_count);
        setInbox(i.conversations);
        setInboxTotal(i.total_count);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [days]);

  return { recent, recentTotal, inbox, inboxTotal, loading, error };
}
