// Pulls a Profit & Loss report from Xero for a given date range.
// Body: { fromDate: "YYYY-MM-DD", toDate: "YYYY-MM-DD" }
// Returns the raw Xero report JSON. Used as a sanity-check for the
// connection; future scorecard pulls can adapt the parsing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidAccessToken } from "../_shared/xero.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  try {
    let fromDate: string | undefined;
    let toDate: string | undefined;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      fromDate = body.fromDate;
      toDate = body.toDate;
    } else {
      const url = new URL(req.url);
      fromDate = url.searchParams.get("fromDate") ?? undefined;
      toDate = url.searchParams.get("toDate") ?? undefined;
    }

    if (!fromDate || !toDate) {
      return withCors(Response.json(
        { error: "Provide fromDate and toDate (YYYY-MM-DD)" },
        { status: 400 },
      ));
    }

    const { access_token, tenant_id } = await getValidAccessToken(supabase);

    const params = new URLSearchParams({ fromDate, toDate });
    const res = await fetch(
      `https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?${params}`,
      {
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Xero-tenant-id": tenant_id,
          "Accept": "application/json",
        },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      return withCors(Response.json(
        { ok: false, status: res.status, error: body },
        { status: 502 },
      ));
    }

    const report = await res.json();
    return withCors(Response.json({ ok: true, report }));
  } catch (err) {
    return withCors(Response.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    ));
  }
});
