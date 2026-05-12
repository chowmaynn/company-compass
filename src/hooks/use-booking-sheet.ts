import { useQuery } from "@tanstack/react-query";

// Booking sheet is fetched via a same-origin serverless proxy (`/api/booking-sheet`)
// so the browser doesn't hit script.google.com directly — Apps Script doesn't
// send CORS headers, and this also keeps the token off the client bundle.
const PROXY = "/api/booking-sheet";

interface SheetRow {
  Date: string;
  "Total Qualified"?: number | string;
  "Email General"?: number | string;
  "Welcome Email"?: number | string;
  "Skool Classroom"?: number | string;
  "Skool Setter"?: number | string;
  "Skool Post"?: number | string;
  Website?: number | string;
  "Website B"?: number | string;
  "Website C"?: number | string;
  Masterclass?: number | string;
  Google?: number | string;
  Phone?: number | string;
  // ── Cancellation columns (pre-wired — kick in automatically once added) ──
  "DQ'd"?: number | string;
  Cancellations?: number | string;
  [k: string]: unknown;
}

/**
 * Maps a sheet column header → the Supabase-cube source category we override.
 * Categories match what `get_dynamic_metrics` returns so downstream code that
 * keys off `source_*` keeps working unchanged.
 */
const COLUMN_TO_SOURCE: Record<string, string> = {
  "Email General": "source_email general",
  "Welcome Email": "source_email welcome",
  "Skool Classroom": "source_skool classroom",
  "Skool Setter": "source_skool setter",
  "Skool Post": "source_skool post",
  Website: "source_website",
  "Website B": "source_website b",
  "Website C": "source_website c",
  Masterclass: "source_aios lp", // "Webinar Bookings" in the tracker
  Google: "source_google",
  Phone: "source_phone",
};

/** date → source category → { total_bookings, casey_cancelled } */
export type SheetCube = Record<string, Record<string, { total_bookings: number; casey_cancelled: number }>>;

/** date → { casey_cancelled, invitee_cancelled } — present only when sheet provides cancellation columns */
export type SheetOverallCube = Record<string, { casey_cancelled?: number; invitee_cancelled?: number }>;

const DQ_COL = "DQ'd";                // → casey_cancelled (country disqualifications)
const CANCEL_COL = "Cancellations";   // → invitee_cancelled

async function fetchSheet(): Promise<SheetRow[]> {
  const res = await fetch(PROXY);
  if (!res.ok) throw new Error(`Sheet ${res.status}`);
  const data = await res.json();
  if (data?.error) throw new Error(`Sheet error: ${data.error}`);
  return Array.isArray(data?.rows) ? data.rows : [];
}

function buildCube(rows: SheetRow[]): { cube: SheetCube; overall: SheetOverallCube } {
  const cube: SheetCube = {};
  const overall: SheetOverallCube = {};
  for (const row of rows) {
    const date = String(row.Date ?? "").substring(0, 10);
    if (!date) continue;
    if (!cube[date]) cube[date] = {};
    for (const [col, source] of Object.entries(COLUMN_TO_SOURCE)) {
      const raw = row[col as keyof SheetRow];
      const n = typeof raw === "number" ? raw : Number(raw ?? 0);
      if (!Number.isFinite(n)) continue;
      // Sheet values are already qualified (post-cancellation). Write into
      // total_bookings and zero casey_cancelled so the existing
      // `total_bookings - casey_cancelled` math yields the sheet value.
      cube[date][source] = { total_bookings: n, casey_cancelled: 0 };
    }
    // OVERALL cancellation columns — only populated if the sheet has them.
    const overallEntry: { casey_cancelled?: number; invitee_cancelled?: number } = {};
    const dqd = row[DQ_COL];
    const cancelled = row[CANCEL_COL];
    if (dqd !== undefined && dqd !== "" && Number.isFinite(Number(dqd))) {
      overallEntry.casey_cancelled = Number(dqd);
    }
    if (cancelled !== undefined && cancelled !== "" && Number.isFinite(Number(cancelled))) {
      overallEntry.invitee_cancelled = Number(cancelled);
    }
    if (overallEntry.casey_cancelled !== undefined || overallEntry.invitee_cancelled !== undefined) {
      overall[date] = overallEntry;
    }
  }
  return { cube, overall };
}

export function useBookingSheet() {
  const query = useQuery({
    queryKey: ["booking-sheet"],
    queryFn: fetchSheet,
    staleTime: 5 * 60 * 1000,
  });

  const { cube, overall } = buildCube(query.data ?? []);
  return {
    cube,
    overall,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
