// Xero OAuth 2.0 redirect handler.
// Adam visits the Xero authorize URL once, picks the Vue Mastery org, and
// Xero redirects here with ?code=... — we exchange the code for tokens,
// fetch the tenant_id from /connections, and upsert the singleton row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const XERO_CLIENT_ID = Deno.env.get("XERO_CLIENT_ID")!;
const XERO_CLIENT_SECRET = Deno.env.get("XERO_CLIENT_SECRET")!;
const XERO_REDIRECT_URI = Deno.env.get("XERO_REDIRECT_URI")!;

const TOKEN_URL = "https://identity.xero.com/connect/token";
const CONNECTIONS_URL = "https://api.xero.com/connections";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function basicAuth() {
  return "Basic " + btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`);
}

function html(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><meta charset=utf-8><title>Xero connection</title>
<style>body{font-family:system-ui;max-width:560px;margin:80px auto;padding:0 20px;color:#111}
h1{font-size:20px}code{background:#f3f3f3;padding:2px 6px;border-radius:4px}</style>
${body}`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return html(`<h1>Xero authorization failed</h1><p>${error}</p>`, 400);
  }
  if (!code) {
    return html(`<h1>Missing <code>code</code> parameter</h1>`, 400);
  }

  // 1. Exchange code → tokens
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": basicAuth(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: XERO_REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    return html(`<h1>Token exchange failed</h1><pre>${body}</pre>`, 502);
  }
  const tokens = await tokenRes.json();

  // 2. Fetch tenant_id from /connections
  const connRes = await fetch(CONNECTIONS_URL, {
    headers: {
      "Authorization": `Bearer ${tokens.access_token}`,
      "Accept": "application/json",
    },
  });
  if (!connRes.ok) {
    const body = await connRes.text();
    return html(`<h1>Failed to fetch /connections</h1><pre>${body}</pre>`, 502);
  }
  const connections = await connRes.json() as Array<{ tenantId: string; tenantName: string }>;
  if (!connections.length) {
    return html(`<h1>No Xero tenants returned</h1>`, 502);
  }
  const tenant = connections[0];

  // 3. Upsert singleton row
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const { error: dbError } = await supabase
    .from("xero_connection")
    .upsert({
      id: 1,
      tenant_id: tenant.tenantId,
      tenant_name: tenant.tenantName,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });

  if (dbError) {
    return html(`<h1>Failed to save connection</h1><pre>${dbError.message}</pre>`, 500);
  }

  return html(
    `<h1>✅ Connected to ${tenant.tenantName}</h1>
<p>Tenant ID: <code>${tenant.tenantId}</code></p>
<p>Tokens stored. You can close this tab.</p>`,
  );
});
