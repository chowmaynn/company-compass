async function intercomGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api/intercom${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Intercom GET ${res.status}`);
  return res.json();
}

async function intercomPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/intercom${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Intercom ${res.status}`);
  return res.json();
}

export interface IntercomConversation {
  id: string;
  created_at: number;
  updated_at: number;
  waiting_since: number | null;
  state: "open" | "closed" | "snoozed";
  source: {
    type: string;
    subject?: string;
    author?: { name?: string; email?: string };
  };
  statistics: {
    time_to_admin_reply: number | null;
    first_admin_reply_at: number | null;
    last_contact_reply_at: number | null;
    first_contact_reply_at: number | null;
  };
  conversation_rating: { rating: number | null } | null;
  ai_agent_participated: boolean;
}

interface SearchResponse {
  conversations: IntercomConversation[];
  total_count: number;
  pages: { next?: { starting_after: string } };
}

async function searchPage(query: unknown, perPage: number): Promise<{ conversations: IntercomConversation[]; total_count: number }> {
  const data = await intercomPost<SearchResponse>("/conversations/search", {
    query,
    pagination: { per_page: perPage },
  });
  return { conversations: data.conversations, total_count: data.total_count };
}

export async function fetchAdminMe(): Promise<{ id: string } | null> {
  try {
    const data = await intercomGet<{ id: number | string }>("/me");
    return { id: String(data.id) };
  } catch {
    return null;
  }
}

export async function fetchRecentConversations(days = 30, adminId?: string): Promise<{ conversations: IntercomConversation[]; total_count: number }> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const query = adminId
    ? {
        operator: "AND",
        value: [
          { field: "created_at", operator: ">", value: since },
          { field: "admin_assignee_id", operator: "=", value: Number(adminId) },
        ],
      }
    : { field: "created_at", operator: ">", value: since };
  return searchPage(query, 150);
}

/** All open conversations (for total count reference) */
export async function fetchOpenConversations(): Promise<{ conversations: IntercomConversation[]; total_count: number }> {
  return searchPage({ field: "state", operator: "=", value: "open" }, 50);
}

// ── Ticket Types ─────────────────────────────────────────────

export const TICKET_TYPE_IDS = {
  SUPPORT: 3007702,         // Real support tickets (the "clock")
  BILLING: 3007694,         // Tracker: Billing / Payment Issue
  CANCELLATION: 3007695,    // Tracker: Cancellation
  GENERAL: 3007697,         // Tracker: General Support
  REFUND: 3007698,          // Tracker: Refund (6-Month Plan)
} as const;

export const TRACKER_TYPES = [
  { id: TICKET_TYPE_IDS.BILLING, label: "Billing", color: "#f59e0b" },
  { id: TICKET_TYPE_IDS.CANCELLATION, label: "Cancellation", color: "#ef4444" },
  { id: TICKET_TYPE_IDS.GENERAL, label: "General Support", color: "#6366f1" },
  { id: TICKET_TYPE_IDS.REFUND, label: "Refund", color: "#10b981" },
] as const;

export interface IntercomTicket {
  id: string;
  ticket_id: string;
  created_at: number;
  updated_at: number;
  open: boolean;
  ticket_state: { category: string; internal_label: string };
  ticket_type: { id: number; name: string };
  ticket_attributes: Record<string, unknown>;
  contacts: { contacts: { id: string; type: string }[] };
  admin_assignee_id: number | null;
  linked_objects: { data: { id: string; type: string; category: string }[] };
}

interface TicketSearchResponse {
  tickets: IntercomTicket[];
  total_count: number;
  pages: { next?: { starting_after: string } };
}

async function searchTickets(query: unknown, perPage: number): Promise<{ tickets: IntercomTicket[]; total_count: number }> {
  const data = await intercomPost<TicketSearchResponse>("/tickets/search", {
    query,
    pagination: { per_page: perPage },
  });
  return { tickets: data.tickets ?? [], total_count: data.total_count ?? 0 };
}

/** Fetch real support tickets (type 3007702) within a date range */
export async function fetchSupportTickets(startISO: string, endISO: string): Promise<{ tickets: IntercomTicket[]; total_count: number }> {
  if (!startISO || !endISO) return { tickets: [], total_count: 0 };
  const since = Math.floor(new Date(startISO).getTime() / 1000);
  const until = Math.floor(new Date(endISO).getTime() / 1000);
  return searchTickets({
    operator: "AND",
    value: [
      { field: "created_at", operator: ">", value: since },
      { field: "created_at", operator: "<", value: until },
      { field: "ticket_type_id", operator: "=", value: TICKET_TYPE_IDS.SUPPORT },
    ],
  }, 150);
}

/** Fetch tracker ticket count and state breakdown for a given type within a date range */
export async function fetchTrackerTickets(
  startISO: string,
  endISO: string,
  ticketTypeId: number
): Promise<{ tickets: IntercomTicket[]; total_count: number }> {
  if (!startISO || !endISO) return { tickets: [], total_count: 0 };
  const since = Math.floor(new Date(startISO).getTime() / 1000);
  const until = Math.floor(new Date(endISO).getTime() / 1000);
  return searchTickets({
    operator: "AND",
    value: [
      { field: "created_at", operator: ">", value: since },
      { field: "created_at", operator: "<", value: until },
      { field: "ticket_type_id", operator: "=", value: ticketTypeId },
    ],
  }, 150);
}

/** Fetch contact name by ID */
export async function fetchContactName(contactId: string): Promise<string> {
  try {
    const data = await intercomGet<{ name?: string; email?: string }>(`/contacts/${contactId}`);
    return data.name || data.email || "Unknown";
  } catch {
    return "Unknown";
  }
}

/** Fetch a single ticket's first customer message */
export async function fetchTicketFirstMessage(ticketId: string): Promise<string> {
  try {
    const data = await intercomGet<{ ticket_parts: { ticket_parts: { author: { type: string }; body: string }[] } }>(`/tickets/${ticketId}`);
    const parts = data.ticket_parts?.ticket_parts ?? [];
    const userPart = parts.find((p) => p.author?.type === "user" || p.author?.type === "contact");
    if (userPart?.body) {
      return userPart.body.replace(/<[^>]*>/g, "").trim().slice(0, 120) || "—";
    }
    return "—";
  } catch {
    return "—";
  }
}

/** Open conversations assigned to a specific admin — "Your inbox" */
export async function fetchYourInboxConversations(adminId: string): Promise<{ conversations: IntercomConversation[]; total_count: number }> {
  return searchPage(
    {
      operator: "AND",
      value: [
        { field: "state", operator: "=", value: "open" },
        { field: "admin_assignee_id", operator: "=", value: Number(adminId) },
      ],
    },
    50
  );
}
