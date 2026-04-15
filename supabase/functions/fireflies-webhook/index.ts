// Supabase Edge Function: Fireflies Webhook Handler
// Receives a POST from Fireflies when a transcription completes,
// fetches that single transcript, upserts it, and triggers embedding.
//
// Configure in Fireflies: Settings → Integrations → Webhooks
// Event: "Transcription completed"
// URL: https://kchvoljychmnedhoisre.supabase.co/functions/v1/fireflies-webhook

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIREFLIES_API_KEY = Deno.env.get("FIREFLIES_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FIREFLIES_API = "https://api.fireflies.ai/graphql";

// Title → meeting_type map. Only sync these exact titles.
const TITLE_TO_TYPE: Record<string, string> = {
  "AAA Management - Stand Up": "standup",
  "Weekly Scorecard Review Meeting | Accelerator Leadership": "scorecard",
};

interface FirefliesTranscript {
  id: string;
  title: string;
  date: number;
  duration: number | null;
  organizer_email: string | null;
  participants: string[] | null;
  summary: unknown;
  sentences: unknown;
  transcript_url: string | null;
  audio_url: string | null;
}

async function fetchTranscriptById(id: string): Promise<FirefliesTranscript | null> {
  const query = `
    query Transcript($transcriptId: String!) {
      transcript(id: $transcriptId) {
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

  const res = await fetch(FIREFLIES_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIREFLIES_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { transcriptId: id } }),
  });

  if (!res.ok) {
    console.error(`[fireflies-webhook] Fetch failed: ${res.status}`, await res.text());
    return null;
  }
  const json = await res.json();
  if (json.errors) {
    console.error("[fireflies-webhook] GraphQL errors:", json.errors);
    return null;
  }
  return json.data?.transcript ?? null;
}

async function upsertTranscript(t: FirefliesTranscript): Promise<boolean> {
  const meetingType = TITLE_TO_TYPE[t.title];
  if (!meetingType) {
    console.log(`[fireflies-webhook] Title "${t.title}" not in TARGET_TITLES — skipping`);
    return false;
  }

  const dateIso = new Date(typeof t.date === "number" ? t.date : Date.parse(String(t.date))).toISOString();

  const { error } = await supabase
    .from("fireflies_transcripts")
    .upsert({
      id: t.id,
      title: t.title,
      meeting_type: meetingType,
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
    console.error(`[fireflies-webhook] Upsert failed for ${t.id}:`, error.message);
    return false;
  }
  return true;
}

async function triggerEmbed(transcriptId: string) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/embed-transcripts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transcript_id: transcriptId }),
    });
    if (!res.ok) {
      console.warn(`[fireflies-webhook] embed-transcripts returned ${res.status}`);
    } else {
      const json = await res.json();
      console.log(`[fireflies-webhook] Embedded ${transcriptId}: ${json.total_chunks} chunks`);
    }
  } catch (err) {
    console.error("[fireflies-webhook] Failed to trigger embed:", err);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const body = await req.json();
    console.log("[fireflies-webhook] Received:", JSON.stringify(body));

    // Fireflies webhook payload: { meetingId, eventType, clientReferenceId }
    const transcriptId = body.meetingId ?? body.transcriptId ?? body.id;
    const eventType = body.eventType ?? body.event;

    if (!transcriptId) {
      // Test events from Fireflies don't include a real meetingId — return 200 so
      // the test passes and we can verify connectivity.
      console.log("[fireflies-webhook] No meetingId — treating as test event");
      return new Response(JSON.stringify({ ok: true, test: true, received: body }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Only handle transcription-complete events (ignore others)
    if (eventType && !["Transcription completed", "transcription_completed", "transcript.created"].includes(eventType)) {
      console.log(`[fireflies-webhook] Ignoring event type: ${eventType}`);
      return new Response(JSON.stringify({ ok: true, ignored: true, eventType }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch the transcript from Fireflies
    const transcript = await fetchTranscriptById(transcriptId);
    if (!transcript) {
      return new Response(JSON.stringify({ ok: false, error: "Transcript not found in Fireflies" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Upsert (will skip if title doesn't match)
    const upserted = await upsertTranscript(transcript);
    if (!upserted) {
      return new Response(JSON.stringify({ ok: true, skipped: true, title: transcript.title }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Trigger embedding for this specific transcript
    await triggerEmbed(transcript.id);

    return new Response(JSON.stringify({
      ok: true,
      transcript_id: transcript.id,
      title: transcript.title,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[fireflies-webhook] Fatal error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
