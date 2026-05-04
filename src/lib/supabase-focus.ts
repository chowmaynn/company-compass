import { SUPABASE_URL, getSupabaseHeaders } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────

export interface QuarterlySettings {
  id: string;
  quarter: string;
  rallying_cry: string | null;
  daily_bookings_target: number | null;
  daily_close_rate_target: number | null;
  daily_cash_target: number | null;
  updated_at: string;
}

export interface NorthStarMetric {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type InitiativeStatus = "Not Started" | "On-Track" | "Behind" | "Accomplished";

export interface QuarterlyInitiative {
  id: string;
  title: string;
  quarter: string;
  department: string | null;
  north_star_id: string | null;
  status: InitiativeStatus;
  due_date: string | null;
  owner: string | null;         // user email
  stakeholders: string | null;  // comma-separated user emails
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FocusItem {
  id: string;
  user_id: string;
  user_email: string;
  title: string;
  week_start: string;
  completed: boolean;
  completed_at: string | null;
  quarterly_initiative_id: string | null;
  carried_over_from: string | null;
  created_at: string;
  updated_at: string;
}

// ── Team Users ──────────────────────────────────────────────

export async function fetchTeamUsers(): Promise<{ user_id: string; user_email: string }[]> {
  const headers = await getSupabaseHeaders();
  // Query the team_members view (exposes auth.users id + email)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/team_members?select=user_id,user_email&order=user_email`,
    { headers }
  );
  if (res.ok) {
    const rows: { user_id: string; user_email: string }[] = await res.json();
    if (Array.isArray(rows) && rows.length > 0) return rows;
  }
  // Fallback: distinct users from team_tasks
  const fallback = await fetch(
    `${SUPABASE_URL}/rest/v1/team_tasks?select=user_id,user_email&order=user_email`,
    { headers }
  );
  if (!fallback.ok) return [];
  const fbRows: { user_id: string; user_email: string }[] = await fallback.json();
  const seen = new Set<string>();
  return fbRows.filter((r) => {
    if (seen.has(r.user_id)) return false;
    seen.add(r.user_id);
    return true;
  });
}

// ── Focus Items ──────────────────────────────────────────────

export async function fetchFociForWeek(weekStart: string): Promise<FocusItem[]> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/team_tasks?week_start=eq.${weekStart}&order=user_email,created_at`,
    { headers }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function fetchIncompletePreviousFoci(beforeWeek: string, userId: string): Promise<FocusItem[]> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/team_tasks?week_start=lt.${beforeWeek}&completed=eq.false&user_id=eq.${userId}&order=week_start.desc&limit=20`,
    { headers }
  );
  if (!res.ok) return [];
  const items: FocusItem[] = await res.json();
  // Only carry over from the most recent week
  if (items.length === 0) return [];
  const latestWeek = items[0].week_start;
  return items.filter((i) => i.week_start === latestWeek);
}

export async function createFocusItem(item: {
  user_id: string;
  user_email: string;
  title: string;
  week_start: string;
  quarterly_initiative_id?: string | null;
  carried_over_from?: string | null;
}): Promise<FocusItem | null> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/team_tasks`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      ...item,
      completed: false,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : null;
}

export async function updateFocusItem(
  id: string,
  updates: Partial<Pick<FocusItem, "title" | "completed" | "completed_at" | "quarterly_initiative_id">>
): Promise<boolean> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/team_tasks?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
  });
  return res.ok;
}

export async function deleteFocusItem(id: string): Promise<boolean> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/team_tasks?id=eq.${id}`, {
    method: "DELETE",
    headers,
  });
  return res.ok;
}

// ── North Star Metrics ──────────────────────────────────────

export async function fetchNorthStarMetrics(): Promise<NorthStarMetric[]> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/north_star_metrics?active=eq.true&order=title`,
    { headers }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function createNorthStarMetric(metric: {
  title: string;
  description?: string | null;
  created_by: string;
}): Promise<NorthStarMetric | null> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/north_star_metrics`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ ...metric, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : null;
}

export async function updateNorthStarMetric(
  id: string,
  updates: Partial<Pick<NorthStarMetric, "title" | "description" | "active">>
): Promise<boolean> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/north_star_metrics?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
  });
  return res.ok;
}

export async function deleteNorthStarMetric(id: string): Promise<boolean> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/north_star_metrics?id=eq.${id}`, {
    method: "DELETE",
    headers,
  });
  return res.ok;
}

// ── Quarterly Settings (rallying cry) ───────────────────────

export async function fetchQuarterlySettings(quarter: string): Promise<QuarterlySettings | null> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/quarterly_settings?quarter=eq.${quarter}&limit=1`,
    { headers }
  );
  if (!res.ok) return null;
  const rows: QuarterlySettings[] = await res.json();
  return rows[0] ?? null;
}

export async function upsertQuarterlySettings(quarter: string, rallyingCry: string): Promise<boolean> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/quarterly_settings`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ quarter, rallying_cry: rallyingCry, updated_at: new Date().toISOString() }),
  });
  return res.ok;
}

/** Returns all distinct quarters that have rows in quarterly_settings. */
export async function fetchAllQuarters(): Promise<string[]> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/quarterly_settings?select=quarter&order=quarter.desc`,
    { headers }
  );
  if (!res.ok) return [];
  const rows: { quarter: string }[] = await res.json();
  return rows.map((r) => r.quarter);
}

// ── Quarterly Initiatives (table: quarterly_initiatives) ──────────

export async function fetchQuarterlyInitiatives(quarter: string): Promise<QuarterlyInitiative[]> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/quarterly_initiatives?quarter=eq.${quarter}&order=title`,
    { headers }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function createQuarterlyInitiative(initiative: {
  title: string;
  quarter: string;
  department?: string | null;
  north_star_id?: string | null;
  due_date?: string | null;
  owner?: string | null;
  stakeholders?: string | null;
  created_by: string;
}): Promise<QuarterlyInitiative | null> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/quarterly_initiatives`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ ...initiative, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : null;
}

export async function updateQuarterlyInitiative(
  id: string,
  updates: Partial<Pick<QuarterlyInitiative, "title" | "department" | "north_star_id" | "status" | "due_date" | "owner" | "stakeholders">>
): Promise<boolean> {
  const headers = await getSupabaseHeaders();
  // return=representation so we can tell the difference between
  // "row updated" (array with the row) and "RLS silently filtered the WHERE
  // clause to 0 rows" (empty array, status 200). With return=minimal both
  // look like 204 success.
  const res = await fetch(`${SUPABASE_URL}/rest/v1/quarterly_initiatives?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    console.error("updateQuarterlyInitiative failed:", res.status, await res.text());
    return false;
  }
  const rows = await res.json();
  if (Array.isArray(rows) && rows.length === 0) {
    console.error("updateQuarterlyInitiative: 0 rows updated — RLS likely blocked the write for id", id);
    return false;
  }
  return true;
}

export async function deleteQuarterlyInitiative(id: string): Promise<boolean> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/quarterly_initiatives?id=eq.${id}`, {
    method: "DELETE",
    headers,
  });
  return res.ok;
}
