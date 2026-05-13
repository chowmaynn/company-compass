// Xero connection sanity check.
// Uses the stored tokens (refreshing if needed) to call /connections and
// returns the connected tenant(s). If this works, the OAuth wiring is sound
// and follow-up functions can call any Xero API the same way.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidAccessToken } from "../_shared/xero.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (_req) => {
  try {
    const { access_token } = await getValidAccessToken(supabase);

    const res = await fetch("https://api.xero.com/connections", {
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      return Response.json(
        { connected: false, status: res.status, error: body },
        { status: 502 },
      );
    }

    const tenants = await res.json();
    return Response.json({ connected: true, tenants });
  } catch (err) {
    return Response.json(
      { connected: false, error: (err as Error).message },
      { status: 500 },
    );
  }
});
