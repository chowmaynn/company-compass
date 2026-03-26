const SUPABASE_URL = import.meta.env.VITE_OPSHUB_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_OPSHUB_SUPABASE_ANON_KEY;

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export interface ScorecardRow {
  id: string;
  metric: string;
  department: string;
  month: string;
  year: string;
  catchup_actual: string;
  catchup_target: string;
  w1_actual: string;
  w1_target: string;
  w2_actual: string;
  w2_target: string;
  w3_actual: string;
  w3_target: string;
  w4_actual: string;
  w4_target: string;
  monthly_actual: string;
  monthly_target: string;
  status: string;
  owner: string;
  source: string;
  description: string;
  updated_at: string;
}

/**
 * Fetch distinct months available in the scorecard table, sorted descending.
 */
export async function fetchAvailableMonths(): Promise<string[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/scorecard?select=month&order=month.desc`,
    { headers }
  );
  if (!res.ok) return [];
  const rows: { month: string }[] = await res.json();
  return [...new Set(rows.map((r) => r.month))];
}

/**
 * Fetch all scorecard rows for a given month.
 */
export async function fetchScorecard(month: string): Promise<ScorecardRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/scorecard?month=eq.${month}&order=department,metric`,
    { headers }
  );
  if (!res.ok) {
    console.error("Supabase scorecard fetch error:", res.status);
    return [];
  }
  return res.json();
}

/**
 * Fetch Revenue rows across multiple months for the trend chart.
 */
export async function fetchRevenueHistory(months: string[]): Promise<ScorecardRow[]> {
  if (months.length === 0) return [];
  const filter = months.map((m) => `month.eq.${m}`).join(",");
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/scorecard?metric=eq.Revenue&or=(${filter})&order=month.asc`,
    { headers }
  );
  if (!res.ok) {
    console.error("Supabase revenue history fetch error:", res.status);
    return [];
  }
  return res.json();
}

/**
 * Update a single cell in a scorecard row.
 * Uses metric + month as the unique key.
 */
export async function updateScorecardCell(
  metric: string,
  month: string,
  field: string,
  value: string
): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/scorecard?metric=eq.${encodeURIComponent(metric)}&month=eq.${month}`,
    {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ [field]: value, updated_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) {
    console.error("Supabase update error:", res.status, await res.text());
    return false;
  }
  return true;
}
