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
