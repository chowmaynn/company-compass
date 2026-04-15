// Supabase Edge Function: Chat with Transcripts (RAG)
// Receives a user question + conversation history,
// embeds the question, retrieves top-N relevant transcript chunks,
// and streams an answer back from OpenAI's chat API.
//
// POST body: { messages: [{role, content}], meeting_type?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const EMBED_MODEL = "text-embedding-3-small";
const CHAT_MODEL = "gpt-4o"; // Higher quality for comprehensive summaries
const MATCH_COUNT = 12;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChunkMatch {
  id: string;
  transcript_id: string;
  meeting_type: string | null;
  meeting_date: string;
  speaker: string | null;
  start_time: number | null;
  text: string;
  similarity: number;
}

async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`Embed failed: ${await res.text()}`);
  const json = await res.json();
  return json.data[0].embedding;
}

async function searchChunks(queryEmbedding: number[], meetingType: string | null): Promise<ChunkMatch[]> {
  const { data, error } = await supabase.rpc("match_transcript_chunks", {
    query_embedding: queryEmbedding,
    match_count: MATCH_COUNT,
    filter_meeting_type: meetingType,
  });
  if (error) throw new Error(`RPC failed: ${error.message}`);
  return data ?? [];
}

/** Detect whether the question references recent/latest/last meetings. */
function asksAboutRecent(question: string): boolean {
  return /\b(last|latest|recent|recently|most recent|this week|yesterday|today)\b/i.test(question);
}

/** Infer meeting_type from the question text. Returns null if ambiguous. */
function inferMeetingType(question: string): string | null {
  if (/\bscorecard\b/i.test(question)) return "scorecard";
  if (/\bstand[\s-]?up\b/i.test(question)) return "standup";
  return null;
}

/** Get all chunks from the most recent N meetings (optionally filtered by type). */
async function getRecentMeetingChunks(meetingType: string | null, meetingCount: number): Promise<ChunkMatch[]> {
  // First, find the IDs of the most recent N meetings
  let q = supabase
    .from("fireflies_transcripts")
    .select("id, date, meeting_type")
    .order("date", { ascending: false })
    .limit(meetingCount);
  if (meetingType) q = q.eq("meeting_type", meetingType);

  const { data: recentTranscripts, error: tErr } = await q;
  if (tErr || !recentTranscripts || recentTranscripts.length === 0) return [];

  const ids = recentTranscripts.map((t) => t.id);

  // Fetch all chunks for those transcripts
  const { data: chunks, error: cErr } = await supabase
    .from("transcript_chunks")
    .select("id, transcript_id, meeting_type, meeting_date, speaker, start_time, text")
    .in("transcript_id", ids)
    .order("meeting_date", { ascending: false })
    .order("start_time", { ascending: true });
  if (cErr || !chunks) return [];

  return chunks.map((c) => ({ ...c, similarity: 1.0 }));
}

/** Merge two chunk lists, deduping by id. */
function mergeChunks(a: ChunkMatch[], b: ChunkMatch[]): ChunkMatch[] {
  const seen = new Set<string>();
  const result: ChunkMatch[] = [];
  for (const chunk of [...a, ...b]) {
    if (seen.has(chunk.id)) continue;
    seen.add(chunk.id);
    result.push(chunk);
  }
  return result;
}

function formatTime(secs: number | null): string {
  if (secs == null) return "";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NZ", { month: "short", day: "numeric", year: "numeric" });
}

function buildSystemPrompt(chunks: ChunkMatch[]): string {
  // Sort chunks chronologically (most recent first) so the model
  // understands what's "latest" and source numbers match recency
  const sorted = [...chunks].sort((a, b) =>
    new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
  );
  const sortedContext = sorted.map((c, i) => {
    const meetingLabel = c.meeting_type === "standup" ? "Standup"
      : c.meeting_type === "scorecard" ? "Scorecard Review"
      : "Meeting";
    const time = formatTime(c.start_time);
    return `[Source ${i + 1}] ${meetingLabel} on ${formatDate(c.meeting_date)}${time ? ` @ ${time}` : ""}${c.speaker ? ` (${c.speaker})` : ""}:
${c.text}`;
  }).join("\n\n");

  const today = new Date().toLocaleDateString("en-NZ", { month: "long", day: "numeric", year: "numeric" });

  return `You are an executive assistant who creates thorough, structured summaries of the team's recorded meetings. Today's date is ${today}.

Use ONLY the source excerpts below to answer. Sources are sorted by date, most recent first. When the user asks about "the last/latest/most recent" meeting, refer only to the most recent date in the sources.

# Team & Departments
- **Finance** — led by Lana Lisichkina
- **Content** — led by Adam Jahr
- **Marketing** — led by Casey Kristof (sometimes Josh Brown and Adam Jahr)
- **Sales** — led by Josh Brown and Matt
- **Product** — led by Nicholay Voyvik

# Summary Format (when asked to summarize a meeting)
Produce a comprehensive, well-structured summary that reads like a thoughtful executive recap — flowing narrative prose, NOT bullet points. Include every department even if briefly.

Format:

**Meeting:** [meeting type] on [date]
**Attendees:** [list of speakers from sources]

## Finance — Lana
Write 1–3 paragraphs covering what Lana shared and any financial topics discussed. Use prose, not bullets. Weave in specific numbers and direct quotes naturally. If Lana didn't speak this meeting, write a single sentence: "No Finance update this meeting."

## Content — Adam
Write 1–3 paragraphs about Adam's content updates — video production, YouTube performance, the content pipeline, etc. Be specific with metrics and decisions.

## Marketing — Casey (and Josh/Adam if relevant)
Write 1–3 paragraphs covering marketing topics: ads performance, bookings, email campaigns, webinars, channel performance. Mention specific numbers and quote speakers when impactful.

## Sales — Josh and Matt
Write 1–3 paragraphs on sales metrics: calls booked/taken, show rates, close rates, rep performance, deal pipeline, and any decisions about reps.

## Product — Nicholay
Write 1–3 paragraphs on product updates: feature releases, beta tests, system improvements, technical work.

## Other Topics & Decisions
A short paragraph or two covering cross-department discussions, decisions made, action items, or notable items not fitting elsewhere.

Style notes:
- Write in flowing paragraphs, not bullet lists. Bullets are only acceptable for genuinely list-like content (e.g. a list of action items in the closing section).
- Quote people directly when their words are notable (e.g., Casey said "...").
- Be specific — actual numbers, names, and concrete details over vague summaries.
- Don't include source citations like "[Source 1]" — write naturally.

If the user asks a focused question (not a full summary), answer that question directly in conversational prose without the section format.

If the answer isn't in the sources, say so honestly.

SOURCES:
${sortedContext}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages ?? [];
    const meetingType: string | null = body.meeting_type ?? null;

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) {
      return new Response(JSON.stringify({ error: "No user message provided" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // 1. Embed the user's question
    const queryEmbedding = await embedQuery(lastUserMessage.content);

    // 2. Retrieve relevant chunks via semantic search
    const semanticChunks = await searchChunks(queryEmbedding, meetingType);

    // 3. If the question references recent/latest meetings, also include all chunks
    //    from the most recent meeting (so date-aware questions get full context).
    //    If user picked a meeting type from the dropdown, use that.
    //    Otherwise, infer from the question text (e.g. "last Scorecard" → scorecard).
    let chunks = semanticChunks;
    if (asksAboutRecent(lastUserMessage.content)) {
      const inferredType = meetingType ?? inferMeetingType(lastUserMessage.content);
      const recentChunks = await getRecentMeetingChunks(inferredType, 1);
      chunks = mergeChunks(recentChunks, semanticChunks);
    }

    // 3. Build conversation for OpenAI: system prompt with context + history
    const systemPrompt = buildSystemPrompt(chunks);
    const openaiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // 4. Call OpenAI with streaming
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: openaiMessages,
        stream: true,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      throw new Error(`OpenAI ${openaiRes.status}: ${errText}`);
    }

    // 5. Stream response back, prefixed with sources
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        // First send the sources as a JSON header line
        // Sort sources chronologically (most recent first) to match the system prompt order
        const sortedChunks = [...chunks].sort((a, b) =>
          new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
        );
        controller.enqueue(encoder.encode(`__SOURCES__${JSON.stringify(sortedChunks)}\n`));

        // Then forward the OpenAI SSE stream — extract text deltas
        const reader = openaiRes.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const payload = trimmed.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payload);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(encoder.encode(delta));
              } catch { /* skip malformed */ }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[chat-transcripts] Error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
