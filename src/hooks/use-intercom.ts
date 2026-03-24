import { useState, useEffect } from "react";
import {
  fetchRecentConversations,
  fetchOpenConversations,
  type IntercomConversation,
} from "@/lib/intercom";

export type { IntercomConversation };

export interface IntercomData {
  recent: IntercomConversation[];
  recentTotal: number;
  open: IntercomConversation[];
  openTotal: number;
  loading: boolean;
  error: string | null;
}

export function useIntercom(): IntercomData {
  const [recent, setRecent] = useState<IntercomConversation[]>([]);
  const [recentTotal, setRecentTotal] = useState(0);
  const [open, setOpen] = useState<IntercomConversation[]>([]);
  const [openTotal, setOpenTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchRecentConversations(30), fetchOpenConversations()])
      .then(([r, o]) => {
        setRecent(r.conversations);
        setRecentTotal(r.total_count);
        setOpen(o.conversations);
        setOpenTotal(o.total_count);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return { recent, recentTotal, open, openTotal, loading, error };
}
