/**
 * Shared Supabase REST client for the Company Compass (OpsHub) project.
 * All files needing Supabase access should import from here.
 */

import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_COMPASS_SUPABASE_URL;
export const SUPABASE_KEY = import.meta.env.VITE_COMPASS_SUPABASE_ANON_KEY;

/** Supabase JS client — used for auth and realtime features */
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Build headers with the current session token (if logged in),
 * falling back to the anon key for unauthenticated contexts.
 */
export async function getSupabaseHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_KEY;
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

/**
 * Static headers using anon key — for use in module-level code
 * where async isn't possible (e.g., hook initialization).
 * Prefer getSupabaseHeaders() in async contexts.
 */
export const supabaseHeaders: Record<string, string> = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

/** Convenience GET wrapper for Supabase REST API (uses session token) */
export async function supabaseGet<T = unknown>(path: string): Promise<T> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) {
    console.error(`Supabase GET ${path} failed:`, res.status);
    throw new Error(`Supabase ${res.status}`);
  }
  return res.json();
}

/** Convenience POST/PATCH wrapper for Supabase REST API (uses session token) */
export async function supabaseMutate(
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const headers = await getSupabaseHeaders();
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...headers, ...extraHeaders },
    body: JSON.stringify(body),
  });
}
