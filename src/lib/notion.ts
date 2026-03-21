const NOTION_API_KEY = import.meta.env.VITE_NOTION_API_KEY;
const CONTENT_DB_ID = import.meta.env.VITE_NOTION_CONTENT_DB;

/**
 * Statuses that count as "in the backlog" — filmed/uploaded and in the editing pipeline,
 * but not yet published.
 */
const BACKLOG_STATUSES = [
  "Filmed",
  "Uploaded",
  "Create Resource",
  "Transcription Added",
  "Generate Images",
  "Images Ready",
  "Generate Icons",
  "Icons Ready",
  "Generate Videos",
  "Generations Ready",
  "Editing Draft",
  "Review Draft",
  "Feedback on Draft",
  "Editing Final",
  "Review Final",
  "Feedback on Final",
  "Ready to Publish ⌛️",
];

interface NotionPage {
  properties: {
    Status?: { status?: { name: string } };
    "Publish Date"?: { date?: { start: string } | null };
  };
}

async function queryDatabase(filter: Record<string, unknown>): Promise<NotionPage[]> {
  if (!NOTION_API_KEY || !CONTENT_DB_ID) return [];

  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = { filter, page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`/api/notion/v1/databases/${CONTENT_DB_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("Notion API error:", res.status, await res.text());
      return pages;
    }

    const data = await res.json();
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return pages;
}

/**
 * Fetch count of videos currently in the editing backlog.
 */
export async function fetchBacklogCount(): Promise<number> {
  const filter = {
    or: BACKLOG_STATUSES.map((status) => ({
      property: "Status",
      status: { equals: status },
    })),
  };

  const pages = await queryDatabase(filter);
  return pages.length;
}

/**
 * Fetch count of videos published within a date range.
 */
export async function fetchPublishedCount(startDate: string, endDate: string): Promise<number> {
  const filter = {
    and: [
      { property: "Status", status: { equals: "Published" } },
      { property: "Publish Date", date: { on_or_after: startDate } },
      { property: "Publish Date", date: { before: endDate } },
    ],
  };

  const pages = await queryDatabase(filter);
  return pages.length;
}
