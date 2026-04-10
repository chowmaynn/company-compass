import { SUPABASE_URL, getSupabaseHeaders } from "@/lib/supabase";

// ── Types ────────────────────────────────────────────────────

export interface QuarterlyGoal {
  id: string;
  title: string;
  quarter: string;
  department: string | null;
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
  quarterly_goal_id: string | null;
  carried_over_from: string | null;
  created_at: string;
  updated_at: string;
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
  quarterly_goal_id?: string | null;
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
  updates: Partial<Pick<FocusItem, "title" | "completed" | "completed_at" | "quarterly_goal_id">>
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

// ── Quarterly Goals ──────────────────────────────────────────

export async function fetchQuarterlyGoals(quarter: string): Promise<QuarterlyGoal[]> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/quarterly_goals?quarter=eq.${quarter}&order=title`,
    { headers }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function createQuarterlyGoal(goal: {
  title: string;
  quarter: string;
  department?: string | null;
  created_by: string;
}): Promise<QuarterlyGoal | null> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/quarterly_goals`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ ...goal, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : null;
}
