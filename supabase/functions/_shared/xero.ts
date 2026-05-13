// Shared Xero helpers: token refresh + authenticated fetch.
// Edge functions that need to call Xero APIs should call getValidAccessToken()
// to get a non-expired access token + the connected tenant_id.

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN_URL = "https://identity.xero.com/connect/token";

interface XeroConnectionRow {
  tenant_id: string;
  tenant_name: string | null;
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO timestamptz
}

export interface XeroAuth {
  access_token: string;
  tenant_id: string;
}

function basicAuthHeader(): string {
  const id = Deno.env.get("XERO_CLIENT_ID")!;
  const secret = Deno.env.get("XERO_CLIENT_SECRET")!;
  return "Basic " + btoa(`${id}:${secret}`);
}

async function refresh(
  supabase: SupabaseClient,
  row: XeroConnectionRow,
): Promise<XeroAuth> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Xero token refresh failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

  const { error } = await supabase
    .from("xero_connection")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) throw new Error(`Failed to persist refreshed Xero tokens: ${error.message}`);

  return { access_token: data.access_token, tenant_id: row.tenant_id };
}

export async function getValidAccessToken(supabase: SupabaseClient): Promise<XeroAuth> {
  const { data, error } = await supabase
    .from("xero_connection")
    .select("tenant_id, tenant_name, access_token, refresh_token, expires_at")
    .eq("id", 1)
    .single();

  if (error || !data) {
    throw new Error("Xero is not connected — visit the authorize URL to connect first.");
  }

  const row = data as XeroConnectionRow;
  const expiresMs = new Date(row.expires_at).getTime();

  // Refresh if expiring within 60 seconds
  if (Date.now() > expiresMs - 60_000) {
    return await refresh(supabase, row);
  }

  return { access_token: row.access_token, tenant_id: row.tenant_id };
}
