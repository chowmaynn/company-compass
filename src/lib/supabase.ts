/**
 * Shared Supabase REST client for the Company Compass (OpsHub) project.
 * All files needing Supabase access should import from here.
 */

export const SUPABASE_URL = import.meta.env.VITE_COMPASS_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_COMPASS_SUPABASE_ANON_KEY;

export const supabaseHeaders: Record<string, string> = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

/** Convenience GET wrapper for Supabase REST API */
export async function supabaseGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: supabaseHeaders });
  if (!res.ok) {
    console.error(`Supabase GET ${path} failed:`, res.status);
    throw new Error(`Supabase ${res.status}`);
  }
  return res.json();
}

/** Convenience POST/PATCH wrapper for Supabase REST API */
export async function supabaseMutate(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...supabaseHeaders, ...extraHeaders },
    body: JSON.stringify(body),
  });
}
