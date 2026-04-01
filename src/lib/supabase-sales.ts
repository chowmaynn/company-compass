import { SUPABASE_URL, getSupabaseHeaders } from "@/lib/supabase";

export interface SalesTrackingRow {
  id: number;
  rep_name: string;
  date: string;
  calls_booked: number;
  calls_taken: number;
  closes: number;
  cc: number;
  no_shows: number;
  cancellations: number;
  reschedules: number;
}

export type SalesMetricField = "calls_booked" | "calls_taken" | "closes" | "cc" | "no_shows" | "cancellations" | "reschedules";

/**
 * Fetch all sales tracking rows for a date range.
 */
export async function fetchSalesTrackingRange(from: string, to: string): Promise<SalesTrackingRow[]> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sales_tracking?date=gte.${from}&date=lte.${to}&order=rep_name,date`,
    { headers }
  );
  if (!res.ok) return [];
  return res.json();
}

/**
 * Fetch all sales tracking rows for a given month (YYYY-MM format).
 */
export async function fetchSalesTracking(month: string): Promise<SalesTrackingRow[]> {
  const [year, m] = month.split("-").map(Number);
  const nextMonth = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, "0")}`;

  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sales_tracking?date=gte.${month}-01&date=lt.${nextMonth}-01&order=rep_name,date`,
    { headers }
  );
  if (!res.ok) {
    console.error("Failed to fetch sales tracking:", res.status);
    return [];
  }
  return res.json();
}

/**
 * Fetch distinct months that have data.
 */
export async function fetchSalesMonths(): Promise<string[]> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sales_tracking?select=date&order=date.desc`,
    { headers }
  );
  if (!res.ok) return [];
  const rows: { date: string }[] = await res.json();
  const months = new Set(rows.map((r) => r.date.slice(0, 7)));
  return [...months].sort().reverse();
}

export interface DailyCloses {
  date: string;
  closes: number;
}

/**
 * Fetch daily team closes aggregated across all reps for a date range.
 */
export async function fetchDailyCloses(from: string, to: string): Promise<DailyCloses[]> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sales_tracking?select=date,closes&date=gte.${from}&date=lte.${to}&order=date`,
    { headers }
  );
  if (!res.ok) return [];
  const rows: { date: string; closes: number }[] = await res.json();

  // Aggregate closes per day across reps
  const byDate = new Map<string, number>();
  for (const r of rows) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.closes);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, closes]) => ({ date, closes }));
}

/**
 * Update a single cell in the sales tracking table.
 */
export async function updateSalesTrackingCell(
  repName: string,
  date: string,
  field: SalesMetricField,
  value: number
): Promise<boolean> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sales_tracking?rep_name=eq.${encodeURIComponent(repName)}&date=eq.${date}`,
    {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ [field]: value }),
    }
  );
  if (!res.ok) {
    console.error("Failed to update sales tracking:", res.status);
    return false;
  }
  return true;
}

/**
 * Upsert a daily row — creates if it doesn't exist, updates if it does.
 */
export async function upsertSalesTrackingCell(
  repName: string,
  date: string,
  field: SalesMetricField,
  value: number
): Promise<boolean> {
  const headers = await getSupabaseHeaders();
  const body: Record<string, unknown> = {
    rep_name: repName,
    date,
    [field]: value,
  };

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sales_tracking`,
    {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    console.error("Failed to upsert sales tracking:", res.status);
    return false;
  }
  return true;
}
