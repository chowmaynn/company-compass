const BASE = "/api/supabase";

const headers = {
  "Content-Type": "application/json",
};

export interface SkoolSource {
  name: string;
  count: number;
  pct: number;
}

export interface SkoolSnapshot {
  id: string;
  snapshot_date: string;
  members: number;
  engagement_pct: number;
  visitors: number;
  signups: number;
  conversion_rate: number;
  sources: SkoolSource[];
  created_at: string;
}

export async function fetchSkoolSnapshots(): Promise<SkoolSnapshot[]> {
  const res = await fetch(
    `${BASE}/rest/v1/skool_snapshots?order=snapshot_date.desc&limit=52`,
    { headers }
  );
  if (!res.ok) {
    console.error("fetchSkoolSnapshots error:", res.status, await res.text());
    return [];
  }
  return res.json();
}

export async function insertSkoolSnapshot(
  data: Omit<SkoolSnapshot, "id" | "created_at">
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/rest/v1/skool_snapshots`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("insertSkoolSnapshot error:", res.status, text);
    return { ok: false, error: `${res.status}: ${text}` };
  }
  return { ok: true };
}
