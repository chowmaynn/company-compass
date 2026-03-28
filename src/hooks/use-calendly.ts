import { useQuery } from "@tanstack/react-query";
import { startOfMonthISO, endOfMonthISO } from "@/lib/dates";
import { SALES_EVENT_NAMES, FOLLOWUP_EVENT_NAMES } from "@/lib/constants";

const BASE = "/api/calendly";
const ORG_URI = "https://api.calendly.com/organizations/407a1705-c820-4818-b8ec-3e4f96860ba2";

// Strip "AAA Accelerator Follow-up (" prefix and ")" suffix for display
function repNameFromEvent(name: string): string {
  const match = name.match(/\(([^)]+)\)$/);
  return match ? match[1].split(" ")[0] : name; // First name only
}

async function calendlyFetch(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Calendly API ${res.status}`);
  return res.json();
}


interface CalendlyEvent {
  uri: string;
  name: string;
  status: "active" | "canceled";
  start_time: string;
  created_at: string;
  event_memberships: { user_email: string; user_name: string }[];
}

async function paginateEvents(status: "active" | "canceled", minStart: string, maxStart: string): Promise<CalendlyEvent[]> {
  const all: CalendlyEvent[] = [];
  const params = new URLSearchParams({
    organization: ORG_URI,
    min_start_time: minStart,
    max_start_time: maxStart,
    count: "100",
    status,
  });

  let nextPath: string | null = `/scheduled_events?${params}`;
  let pages = 0;

  while (nextPath && pages < 20) {
    pages++;
    const data = await calendlyFetch(nextPath);
    all.push(...(data.collection ?? []));

    const nextUrl: string | null = data.pagination?.next_page ?? null;
    if (nextUrl) {
      nextPath = nextUrl.replace("https://api.calendly.com", "");
    } else {
      nextPath = null;
    }
  }

  return all;
}

async function fetchAllEvents(): Promise<CalendlyEvent[]> {
  // Fetch current month only — fast (1-2 pages)
  const som = startOfMonthISO();
  const eom = endOfMonthISO();

  const [active, canceled] = await Promise.all([
    paginateEvents("active", som, eom),
    paginateEvents("canceled", som, eom),
  ]);

  return [...active, ...canceled];
}

export interface BookingByRep {
  rep: string;
  booked: number;
}

export interface DailyBooking {
  date: string;
  count: number;
}

export function useCalendly() {
  const query = useQuery({
    queryKey: ["calendly", "events", startOfMonthISO()],
    queryFn: fetchAllEvents,
    staleTime: 5 * 60 * 1000,
  });

  const allEvents: CalendlyEvent[] = query.data ?? [];

  // Filter to events BOOKED (created_at) in the current month for scorecard metrics
  const som = startOfMonthISO().slice(0, 10);
  const eom = endOfMonthISO().slice(0, 10);
  const thisMonthEvents = allEvents.filter((e) => {
    const created = (e.created_at || e.start_time).slice(0, 10);
    return created >= som && created <= eom;
  });

  // ── SALES events ──────────────────────────────────────
  const salesEvents = thisMonthEvents.filter((e) => SALES_EVENT_NAMES.includes(e.name));
  const salesActive = salesEvents.filter((e) => e.status === "active");
  const salesCanceled = salesEvents.filter((e) => e.status === "canceled");

  const salesBooked = salesEvents.length;
  const emailBooked = salesEvents.filter(
    (e) => e.name === "AAA Accelerator Business Call (Email)" || e.name === "AAA Accelerator Business Call (Welcome Email)"
  ).length;
  const websiteBooked = salesEvents.filter(
    (e) => e.name === "AAA Accelerator Business Call (Website)" ||
           e.name.includes("(Website B)") ||
           e.name.includes("(Website C)")
  ).length;
  const websiteVariantA = salesEvents.filter(
    (e) => e.name === "AAA Accelerator Business Call (Website)"
  ).length;
  const websiteVariantB = salesEvents.filter(
    (e) => e.name.includes("(Website B)") || e.uri?.includes("website-b")
  ).length;
  const websiteVariantC = salesEvents.filter(
    (e) => e.name.includes("(Website C)") || e.uri?.includes("website-c")
  ).length;
  const cancellationRate =
    salesBooked > 0 ? Math.round((salesCanceled.length / salesBooked) * 100) : null;

  // Daily booking trend (active + canceled = booked)
  const dailyBookings: DailyBooking[] = (() => {
    const map: Record<string, number> = {};
    salesEvents.forEach((e) => {
      const day = e.start_time.slice(0, 10);
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
  })();

  // Bookings per rep (by user_name from event_memberships)
  const bookingsByRep: BookingByRep[] = (() => {
    const map: Record<string, number> = {};
    salesActive.forEach((e) => {
      const name = e.event_memberships?.[0]?.user_name ?? "Unknown";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([rep, booked]) => ({ rep, booked }));
  })();

  // ── FOLLOW-UP events ──────────────────────────────────
  const followupEvents = allEvents.filter((e) => FOLLOWUP_EVENT_NAMES.includes(e.name));
  const followupActive = followupEvents.filter((e) => e.status === "active");

  const followupTotal = followupActive.length;

  // Follow-ups per rep
  const followupByRep: BookingByRep[] = (() => {
    const map: Record<string, number> = {};
    followupActive.forEach((e) => {
      const rep = repNameFromEvent(e.name);
      map[rep] = (map[rep] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([rep, booked]) => ({ rep, booked }));
  })();

  // All sales events (wide window, unfiltered by month) for consumers that need custom date filtering
  const allSalesEvents = allEvents.filter((e) => SALES_EVENT_NAMES.includes(e.name));

  return {
    // Raw events for date-range filtering by consumers
    allSalesEvents,
    // Sales (filtered to current month by created_at)
    salesBooked,
    emailBooked,
    websiteBooked,
    websiteVariantA,
    websiteVariantB,
    websiteVariantC,
    salesActive: salesActive.length,
    salesCanceled: salesCanceled.length,
    cancellationRate,
    dailyBookings,
    bookingsByRep,
    // Follow-ups
    followupTotal,
    followupByRep,
    // State
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
