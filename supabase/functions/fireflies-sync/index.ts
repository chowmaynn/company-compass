// Supabase Edge Function: Fireflies Transcript Sync
// Fetches transcripts matching configured title patterns from Fireflies
// and upserts them into the fireflies_transcripts table.
//
// Default behavior: pulls transcripts from the last 7 days (daily run).
// To backfill more, POST { "days": 90 } to the function endpoint.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREFLIES_API_KEY = Deno.env.get("FIREFLIES_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FIREFLIES_API = "https://api.fireflies.ai/graphql";

// Title → meeting_type map. Sync only these exact titles.
const TITLE_TO_TYPE: Record<string, string> = {
  "AAA Management - Stand Up": "standup",
  "Weekly Scorecard Review Meeting | Accelerator Leadership": "scorecard",
};
const TARGET_TITLES = Object.keys(TITLE_TO_TYPE);

interface FirefliesTranscript {
  id: string;
  title: string;
  date: number; // epoch ms from Fireflies
  duration: number | null;
  organizer_email: string | null;
  participants: string[] | null;
  summary: unknown;
  sentences: unknown;
  transcript_url: string | null;
  audio_url: string | null;
}

async function firefliesQuery(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(FIREFLIES_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIREFLIES_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Fireflies API ${res.status}: ${text}`);
  }
  const json = await res.json();
  if (json.errors) throw new Error(`Fireflies GraphQL: ${JSON.stringify(json.errors)}`);
  return json.data;
}

/**
 * Fetch transcripts from Fireflies matching a title keyword, within the date range.
 * Fireflies uses `keyword` to search title + spoken content; we filter exact title locally.
 */
async function fetchTranscriptsForTitle(title: string, fromDate: Date): Promise<FirefliesTranscript[]> {
  const query = `
    query Transcripts($keyword: String, $fromDate: DateTime, $limit: Int, $skip: Int) {
      transcripts(keyword: $keyword, fromDate: $fromDate, limit: $limit, skip: $skip) {
        id
        title
        date
        duration
        organizer_email
        participants
        summary {
          overview
          short_overview
          action_items
          keywords
          shorthand_bullet
          bullet_gist
          gist
          short_summary
          outline
          topics_discussed
        }
        sentences {
          text
          speaker_name
          speaker_id
          start_time
          end_time
        }
        transcript_url
        audio_url
      }
    }
  `;

  const PAGE_SIZE = 50;
  const all: FirefliesTranscript[] = [];
  let skip = 0;

  // Page until we get fewer than PAGE_SIZE back (= no more pages)
  while (true) {
    const data = await firefliesQuery(query, {
      keyword: title,
      fromDate: fromDate.toISOString(),
      limit: PAGE_SIZE,
      skip,
    }) as { transcripts: FirefliesTranscript[] };

    const page = data.transcripts ?? [];
    all.push(...page);
    console.log(`[fireflies-sync] "${title}" page skip=${skip}: ${page.length} fetched (running total ${all.length})`);

    if (page.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;

    // Safety cap — don't loop forever if Fireflies misbehaves
    if (skip >= 5000) {
      console.warn(`[fireflies-sync] Hit 5000-record safety cap for "${title}"`);
      break;
    }
  }

  // Filter to exact title match (Fireflies keyword search is fuzzy)
  return all.filter((t) => t.title === title);
}

async function upsertTranscript(t: FirefliesTranscript) {
  // Fireflies returns date as epoch ms — convert to ISO timestamp
  const dateIso = new Date(typeof t.date === "number" ? t.date : Date.parse(String(t.date))).toISOString();

  const { error } = await supabase
    .from("fireflies_transcripts")
    .upsert({
      id: t.id,
      title: t.title,
      meeting_type: TITLE_TO_TYPE[t.title] ?? null,
      date: dateIso,
      duration: t.duration,
      organizer_email: t.organizer_email,
      participants: t.participants,
      summary: t.summary,
      sentences: t.sentences,
      transcript_url: t.transcript_url,
      audio_url: t.audio_url,
      fetched_at: new Date().toISOString(),
    }, { onConflict: "id" });

  if (error) {
    console.error(`[fireflies-sync] Upsert failed for ${t.id} (${t.title}):`, error.message);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  try {
    // Allow custom day range via POST body for backfills
    let days = 7;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body?.days === "number") days = body.days;
      } catch { /* no body, use default */ }
    }

    const fromDate = new Date(Date.now() - days * 86400000);
    console.log(`[fireflies-sync] Syncing transcripts since ${fromDate.toISOString()} (${days} days)`);

    const results: { title: string; fetched: number; upserted: number; failed: number }[] = [];

    for (const title of TARGET_TITLES) {
      try {
        const transcripts = await fetchTranscriptsForTitle(title, fromDate);
        let upserted = 0, failed = 0;
        for (const t of transcripts) {
          const ok = await upsertTranscript(t);
          if (ok) upserted++; else failed++;
        }
        results.push({ title, fetched: transcripts.length, upserted, failed });
        console.log(`[fireflies-sync] "${title}": fetched=${transcripts.length}, upserted=${upserted}, failed=${failed}`);
      } catch (err) {
        console.error(`[fireflies-sync] Failed for "${title}":`, err);
        results.push({ title, fetched: 0, upserted: 0, failed: -1 });
      }
    }

    // Trigger embedding for any new transcripts (idempotent — only embeds those without chunks)
    try {
      const embedRes = await fetch(`${SUPABASE_URL}/functions/v1/embed-transcripts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      if (!embedRes.ok) {
        console.warn(`[fireflies-sync] embed-transcripts returned ${embedRes.status}`);
      } else {
        const embedJson = await embedRes.json();
        console.log(`[fireflies-sync] embed-transcripts: ${embedJson.transcripts_processed} transcripts, ${embedJson.total_chunks} chunks`);
      }
    } catch (err) {
      console.error("[fireflies-sync] Failed to trigger embed:", err);
    }

    return new Response(JSON.stringify({ ok: true, days, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[fireflies-sync] Fatal error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
