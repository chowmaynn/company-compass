// Supabase Edge Function: Embed Transcripts
// Chunks transcripts that don't yet have chunks in transcript_chunks,
// generates OpenAI embeddings for each chunk, and stores them.
//
// Default: processes any transcript missing chunks (idempotent — safe to re-run).
// POST { "transcript_id": "..." } to embed a specific transcript.
// POST { "force": true } to re-embed all (deletes existing chunks first).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIMS = 1536;
// Target chunk size in chars (~300 tokens). Sentences are joined until this size.
const CHUNK_SIZE = 1200;
// Overlap chars between chunks (preserve context)
const CHUNK_OVERLAP = 200;
// Batch size for OpenAI embedding API (max 2048 inputs per call)
const EMBED_BATCH_SIZE = 96;

interface Sentence {
  text: string;
  speaker_name?: string | null;
  speaker_id?: string | number | null;
  start_time?: number | null;
  end_time?: number | null;
}

interface Transcript {
  id: string;
  title: string;
  meeting_type: string | null;
  date: string;
  sentences: Sentence[] | null;
}

interface Chunk {
  text: string;
  speaker: string | null;
  start_time: number | null;
  end_time: number | null;
}

/** Group sentences into ~CHUNK_SIZE-char chunks with overlap. Preserves dominant speaker + start time. */
function chunkSentences(sentences: Sentence[]): Chunk[] {
  if (!Array.isArray(sentences) || sentences.length === 0) return [];

  const chunks: Chunk[] = [];
  let buf: Sentence[] = [];
  let bufLen = 0;

  for (const s of sentences) {
    const line = `${s.speaker_name ? `${s.speaker_name}: ` : ""}${s.text}`;
    buf.push(s);
    bufLen += line.length + 1;

    if (bufLen >= CHUNK_SIZE) {
      chunks.push(makeChunk(buf));
      // Build overlap: keep tail sentences worth ~CHUNK_OVERLAP chars
      const overlap: Sentence[] = [];
      let overlapLen = 0;
      for (let i = buf.length - 1; i >= 0 && overlapLen < CHUNK_OVERLAP; i--) {
        overlap.unshift(buf[i]);
        overlapLen += (buf[i].text?.length ?? 0) + 1;
      }
      buf = overlap;
      bufLen = overlapLen;
    }
  }
  if (buf.length > 0) chunks.push(makeChunk(buf));
  return chunks;
}

function makeChunk(sentences: Sentence[]): Chunk {
  const text = sentences
    .map((s) => `${s.speaker_name ? `${s.speaker_name}: ` : ""}${s.text}`)
    .join("\n");
  // Dominant speaker = most-occurring speaker in this chunk
  const speakerCount: Record<string, number> = {};
  for (const s of sentences) {
    const sp = s.speaker_name ?? "Unknown";
    speakerCount[sp] = (speakerCount[sp] ?? 0) + 1;
  }
  const dominantSpeaker = Object.entries(speakerCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    text,
    speaker: dominantSpeaker,
    start_time: sentences[0]?.start_time ?? null,
    end_time: sentences[sentences.length - 1]?.end_time ?? null,
  };
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI embeddings ${res.status}: ${errText}`);
  }
  const json = await res.json();
  return json.data.map((d: { embedding: number[] }) => d.embedding);
}

async function processTranscript(t: Transcript): Promise<{ chunks: number; failed: number }> {
  if (!t.sentences || (Array.isArray(t.sentences) && t.sentences.length === 0)) {
    console.log(`[embed] Skipping ${t.id} — no sentences`);
    return { chunks: 0, failed: 0 };
  }

  const chunks = chunkSentences(t.sentences);
  if (chunks.length === 0) return { chunks: 0, failed: 0 };

  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
    try {
      const embeddings = await embedBatch(batch.map((c) => c.text));
      const rows = batch.map((c, idx) => ({
        transcript_id: t.id,
        meeting_type: t.meeting_type,
        meeting_date: t.date,
        speaker: c.speaker,
        start_time: c.start_time,
        end_time: c.end_time,
        text: c.text,
        embedding: embeddings[idx],
      }));
      const { error } = await supabase.from("transcript_chunks").insert(rows);
      if (error) {
        console.error(`[embed] Insert failed for ${t.id} batch ${i}:`, error.message);
        failed += batch.length;
      } else {
        inserted += batch.length;
      }
    } catch (err) {
      console.error(`[embed] Batch failed for ${t.id} batch ${i}:`, err);
      failed += batch.length;
    }
  }

  return { chunks: inserted, failed };
}

Deno.serve(async (req) => {
  try {
    let transcriptId: string | null = null;
    let force = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        transcriptId = body?.transcript_id ?? null;
        force = body?.force === true;
      } catch { /* no body */ }
    }

    // If force, delete all existing chunks (or just for the specified transcript)
    if (force) {
      const q = supabase.from("transcript_chunks").delete();
      const { error } = transcriptId
        ? await q.eq("transcript_id", transcriptId)
        : await q.neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) console.error("[embed] Delete failed:", error.message);
    }

    // Find transcripts to embed
    let toEmbedIds: string[];
    if (transcriptId) {
      toEmbedIds = [transcriptId];
    } else {
      // Get all transcripts that have no chunks yet
      const { data: existing } = await supabase
        .from("transcript_chunks")
        .select("transcript_id");
      const embeddedIds = new Set((existing ?? []).map((r) => r.transcript_id));

      const { data: allTranscripts, error: tErr } = await supabase
        .from("fireflies_transcripts")
        .select("id");
      if (tErr) throw new Error(`Fetch transcripts failed: ${tErr.message}`);

      toEmbedIds = (allTranscripts ?? [])
        .map((r) => r.id)
        .filter((id) => !embeddedIds.has(id));
    }

    console.log(`[embed] Processing ${toEmbedIds.length} transcripts`);

    const results: { id: string; chunks: number; failed: number }[] = [];

    for (const id of toEmbedIds) {
      const { data: t, error } = await supabase
        .from("fireflies_transcripts")
        .select("id, title, meeting_type, date, sentences")
        .eq("id", id)
        .single();
      if (error || !t) {
        console.error(`[embed] Fetch failed for ${id}:`, error?.message);
        continue;
      }
      const result = await processTranscript(t as Transcript);
      results.push({ id, ...result });
      console.log(`[embed] ${id} (${(t as Transcript).title}): chunks=${result.chunks}, failed=${result.failed}`);
    }

    const totalChunks = results.reduce((s, r) => s + r.chunks, 0);
    const totalFailed = results.reduce((s, r) => s + r.failed, 0);

    return new Response(JSON.stringify({
      ok: true,
      transcripts_processed: results.length,
      total_chunks: totalChunks,
      total_failed: totalFailed,
      results,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[embed] Fatal error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
