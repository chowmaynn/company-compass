// Supabase Edge Function: Monthly Scorecard Initialization
// Runs daily via pg_cron. On the first run of a new month, copies metric
// definitions from the previous month into new rows with empty actuals.
// Idempotent — skips if rows already exist for the current month.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function nzOffsetHours(): number {
  const m = new Date().getUTCMonth();
  return (m >= 9 || m <= 2) ? 13 : 12;
}

function getCurrentMonth(): string {
  const offset = nzOffsetHours();
  const nzNow = new Date(Date.now() + offset * 3600000);
  return `${nzNow.getUTCFullYear()}-${String(nzNow.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getPreviousMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

Deno.serve(async (_req) => {
  const logs: string[] = [];

  try {
    const currentMonth = getCurrentMonth();
    const [year] = currentMonth.split("-").map(Number);

    // Check if rows already exist for the current month
    const { count, error: countErr } = await supabase
      .from("scorecard")
      .select("id", { count: "exact", head: true })
      .eq("month", currentMonth);

    if (countErr) {
      return new Response(JSON.stringify({ error: `Count query failed: ${countErr.message}` }), { status: 500 });
    }

    if (count && count > 0) {
      logs.push(`${currentMonth} already has ${count} rows — skipping`);
      return new Response(JSON.stringify({ success: true, logs }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch previous month's rows as template
    const prevMonth = getPreviousMonth(currentMonth);
    const { data: prevRows, error: fetchErr } = await supabase
      .from("scorecard")
      .select("metric, department, owner, source, description, monthly_target, w1_target, w2_target, w3_target, w4_target, catchup_target")
      .eq("month", prevMonth);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: `Fetch previous month failed: ${fetchErr.message}` }), { status: 500 });
    }

    if (!prevRows || prevRows.length === 0) {
      logs.push(`No rows found for previous month ${prevMonth} — cannot seed`);
      return new Response(JSON.stringify({ success: false, logs }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Insert new rows with carried-over targets and empty actuals
    const newRows = prevRows.map((row) => ({
      metric: row.metric,
      department: row.department,
      month: currentMonth,
      year,
      owner: row.owner,
      source: row.source,
      description: row.description,
      monthly_target: row.monthly_target,
      w1_target: row.w1_target,
      w2_target: row.w2_target,
      w3_target: row.w3_target,
      w4_target: row.w4_target,
      catchup_target: row.catchup_target,
      // Actuals start empty
      monthly_actual: "—",
      w1_actual: "—",
      w2_actual: "—",
      w3_actual: "—",
      w4_actual: "—",
      catchup_actual: "—",
      status: "green",
      updated_at: new Date().toISOString(),
    }));

    const { error: insertErr } = await supabase
      .from("scorecard")
      .insert(newRows);

    if (insertErr) {
      logs.push(`Insert failed: ${insertErr.message}`);
      return new Response(JSON.stringify({ error: insertErr.message, logs }), { status: 500 });
    }

    logs.push(`Created ${newRows.length} rows for ${currentMonth} (copied from ${prevMonth})`);
    logs.push(`Metrics: ${newRows.map((r) => r.metric).join(", ")}`);

    return new Response(JSON.stringify({ success: true, logs }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Month init error:", err);
    return new Response(JSON.stringify({ error: String(err), logs }), { status: 500 });
  }
});
