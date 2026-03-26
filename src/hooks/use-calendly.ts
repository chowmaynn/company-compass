import { useQuery } from "@tanstack/react-query";

const BASE = "/api/calendly";
const ORG_URI = "https://api.calendly.com/organizations/407a1705-c820-4818-b8ec-3e4f96860ba2";

export const SALES_EVENT_NAMES = [
  "AAA Accelerator Business Call (Email)",
  "AAA Accelerator Business Call (Google)",
  "AAA Accelerator Business Call (Masterclass)",
  "AAA Accelerator Business Call (Skool A)",
  "AAA Accelerator Business Call (Skool C)",
  "AAA Accelerator Business Call (Skool P)",
  "AAA Accelerator Business Call (Website)",
  "AAA Accelerator Business Call (Welcome Email)",
];

export const FOLLOWUP_EVENT_NAMES = [
  "AAA Accelerator Follow-up (Callum Crees)",
  "AAA Accelerator Follow-up (Harry Hawkes)",
  "AAA Accelerator Follow-up (Jamie Patterson)",
  "AAA Accelerator Follow-up (Joel Price)",
  "AAA Accelerator Follow-up (Kevin Taheryan)",
  "AAA Accelerator Follow-up (Richard Mach)",
];

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

function startOfMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01T00:00:00.000000Z`;
}

function endOfMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const y = last.getFullYear();
  const m = String(last.getMonth() + 1).padStart(2, "0");
  const day = String(last.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}T23:59:59.000000Z`;
}

interface CalendlyEvent {
  uri: string;
  name: string;
  status: "active" | "canceled";
  start_time: string;
  event_memberships: { user_email: string; user_name: string }[];
}

async function fetchAllEvents(): Promise<CalendlyEvent[]> {
  const som = startOfMonth();
  const eom = endOfMonth();
  const params = new URLSearchParams({
    organization: ORG_URI,
    min_start_time: som,
    max_start_time: eom,
    count: "100",
    status: "active",
  });

  const [activeData, canceledData] = await Promise.all([
    calendlyFetch(`/scheduled_events?${params.toString()}`),
    calendlyFetch(
      `/scheduled_events?${new URLSearchParams({ ...Object.fromEntries(params), status: "canceled" }).toString()}`
    ),
  ]);

  return [
    ...(activeData.collection ?? []),
    ...(canceledData.collection ?? []),
  ];
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
    queryKey: ["calendly", "events", startOfMonth()],
    queryFn: fetchAllEvents,
    staleTime: 5 * 60 * 1000,
  });

  const allEvents: CalendlyEvent[] = query.data ?? [];

  // ── SALES events ──────────────────────────────────────
  const salesEvents = allEvents.filter((e) => SALES_EVENT_NAMES.includes(e.name));
  const salesActive = salesEvents.filter((e) => e.status === "active");
  const salesCanceled = salesEvents.filter((e) => e.status === "canceled");

  const salesBooked = salesEvents.length;
  const emailBooked = salesEvents.filter(
    (e) => e.name === "AAA Accelerator Business Call (Email)" || e.name === "AAA Accelerator Business Call (Welcome Email)"
  ).length;
  const websiteBooked = salesEvents.filter(
    (e) => e.name === "AAA Accelerator Business Call (Website)"
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

  return {
    // Sales
    salesBooked,
    emailBooked,
    websiteBooked,
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
