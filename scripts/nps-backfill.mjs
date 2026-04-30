#!/usr/bin/env node
// One-off backfill for NPS Score weekly snapshots in the scorecard table.
//
// Loops over every (month, weekIndex) row that exists in the scorecard table for
// the NPS metrics and POSTs to the snapshot-scorecard edge function with
// { month, weekIndex } overrides. The edge function recomputes per-week NPS from
// Tally history and writes w{N}_actual.
//
// Idempotent: each call overwrites the cell. Safe to re-run.
//
// Usage:
//   export SUPABASE_URL="https://kchvoljychmnedhoisre.supabase.co"
//   export SUPABASE_SERVICE_ROLE_KEY="..."
//   node scripts/nps-backfill.mjs

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const FN_URL = `${SUPABASE_URL}/functions/v1/snapshot-scorecard`;
const HEADERS = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function listMonths() {
  const url = `${SUPABASE_URL}/rest/v1/scorecard?select=month&metric=eq.NPS%20Score%20-%202%20months`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return [...new Set(rows.map((r) => r.month))].sort();
}

async function snapshot(month, weekIndex) {
  // Edge function has verify_jwt=false (new ES256 keys not supported by the
  // runtime's verifier). Send only apikey — Authorization with the new-format
  // sb_secret_* key would fail JWT format validation.
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ month, weekIndex }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`  ${month} W${weekIndex + 1} FAILED ${res.status}: ${text}`);
    return false;
  }
  console.log(`  ${month} W${weekIndex + 1} ok`);
  return true;
}

async function main() {
  const months = await listMonths();
  console.log(`Backfilling NPS for ${months.length} months: ${months.join(", ")}\n`);

  for (const month of months) {
    for (let w = 0; w < 4; w++) {
      await snapshot(month, w);
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
