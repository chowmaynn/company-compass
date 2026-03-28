// Shared YouTube + OpenAI helpers used by competitor-daily, competitor-keywords,
// competitor-outlier, and liam-videos edge functions.

export const LIAM_CHANNEL_ID = "UCui4jxDaMb53Gdh-AZUTPAg";

export function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const mins = parseInt(match[2] || "0");
  const secs = parseInt(match[3] || "0");
  return hours * 60 + mins + secs / 60;
}

export async function fetchYouTubeComments(videoId: string, apiKey: string): Promise<string[]> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&order=relevance&maxResults=50&key=${apiKey}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map(
    (item: any) => item.snippet.topLevelComment.snippet.textOriginal
  );
}

export async function analyzeComments(
  comments: string[],
  openaiKey: string
): Promise<{ sentiment: string; pain_points: string; what_resonated: string } | null> {
  if (comments.length === 0) return null;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: `You are a senior social media strategist analyzing YouTube video comments.
Return a JSON object with exactly these keys:
- "sentiment": overall sentiment (1-2 sentences)
- "pain_points": key pain points viewers mention (comma-separated)
- "what_resonated": what viewers liked or found valuable (comma-separated)

Return ONLY valid JSON, no markdown.`,
        },
        { role: "user", content: comments.slice(0, 30).join("\n---\n") },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  try {
    return JSON.parse(data.choices?.[0]?.message?.content || "null");
  } catch {
    return null;
  }
}
