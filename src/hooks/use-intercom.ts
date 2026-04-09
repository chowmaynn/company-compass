import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  fetchAdminMe,
  fetchRecentConversations,
  fetchYourInboxConversations,
  fetchSupportTickets,
  fetchTrackerTickets,
  TRACKER_TYPES,
  type IntercomConversation,
  type IntercomTicket,
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

// ── Ticket-based hook for Support page ─────────────────────────

export interface TrackerBreakdown {
  id: number;
  label: string;
  color: string;
  total: number;
  states: Record<string, number>; // e.g. { "in_progress": 5, "resolved": 20 }
}

export interface IntercomTicketData {
  tickets: IntercomTicket[];
  totalTickets: number;
  resolvedCount: number;
  openCount: number;
  trackerBreakdown: TrackerBreakdown[];
  loading: boolean;
  error: string | null;
}

async function fetchTicketData(startISO: string, endISO: string) {
  const [support, ...trackers] = await Promise.all([
    fetchSupportTickets(startISO, endISO),
    ...TRACKER_TYPES.map((t) => fetchTrackerTickets(startISO, endISO, t.id)),
  ]);

  const trackerBreakdown: TrackerBreakdown[] = TRACKER_TYPES.map((t, i) => {
    const { tickets, total_count } = trackers[i];
    const states: Record<string, number> = {};
    for (const tk of tickets) {
      const cat = tk.ticket_state?.category ?? "unknown";
      states[cat] = (states[cat] || 0) + 1;
    }
    return { id: t.id, label: t.label, color: t.color, total: total_count, states };
  });

  return { tickets: support.tickets, totalTickets: support.total_count, trackerBreakdown };
}

export function useIntercomTickets(startISO: string, endISO: string): IntercomTicketData {
  const query = useQuery({
    queryKey: ["intercom", "tickets", startISO, endISO],
    queryFn: () => fetchTicketData(startISO, endISO),
    staleTime: 5 * 60 * 1000,
    enabled: !!startISO && !!endISO,
  });

  const tickets = query.data?.tickets ?? [];
  const resolvedCount = useMemo(() =>
    tickets.filter((t) => t.ticket_state?.category === "resolved").length,
    [tickets]
  );
  const openCount = useMemo(() =>
    tickets.filter((t) => t.ticket_state?.category !== "resolved").length,
    [tickets]
  );

  return {
    tickets,
    totalTickets: query.data?.totalTickets ?? 0,
    resolvedCount,
    openCount,
    trackerBreakdown: query.data?.trackerBreakdown ?? [],
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
  };
}

// ── Legacy conversation-based hook (used by scorecard) ─────────

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
