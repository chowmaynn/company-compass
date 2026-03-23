import { useQuery } from "@tanstack/react-query";

const CLOSE_BASE = "/api/close";
const SALES_PIPELINE = "pipe_0Wd57vBUsq5RErzmTF0IvW";
const CALENDLY_BASE = "/api/calendly";
const ORG_URI = "https://api.calendly.com/organizations/407a1705-c820-4818-b8ec-3e4f96860ba2";

export interface Rep {
  id: string;
  display: string;
  closeName: string;        // matches user_name in Close.com
  followupEvent: string;    // Supabase/Calendly event name
}

export const REPS: Rep[] = [
  { id: "callum",    display: "Callum",    closeName: "Callum Crees",        followupEvent: "AAA Accelerator Follow-up (Callum Crees)" },
  { id: "harry",     display: "Harry",     closeName: "Harry Hawkes",         followupEvent: "AAA Accelerator Follow-up (Harry Hawkes)" },
  { id: "jamie",     display: "Jamie",     closeName: "Jamie Patterson",      followupEvent: "AAA Accelerator Follow-up (Jamie Patterson)" },
  { id: "joel",      display: "Joel",      closeName: "Joel Price",           followupEvent: "AAA Accelerator Follow-up (Joel Price)" },
  { id: "kornelius", display: "Kornelius", closeName: "Kornelius Van Heek",   followupEvent: "AAA Accelerator Follow-up (Kornelius Van Heek)" },
];

function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function closeFetch(path: string) {
  const res = await fetch(`${CLOSE_BASE}${path}`);
  if (!res.ok) throw new Error(`Close API ${res.status}`);
  return res.json();
}

async function fetchCalendlyEvents(from: string, to: string) {
  const params = new URLSearchParams({ organization: ORG_URI, min_start_time: `${from}T00:00:00Z`, max_start_time: `${to}T23:59:59Z`, count: "100", status: "active" });
  const res = await fetch(`${CALENDLY_BASE}/scheduled_events?${params}`);
  if (!res.ok) throw new Error(`Calendly ${res.status}`);
  const data = await res.json();
  return data.collection ?? [];
}

export function useRepMetrics(rep: Rep) {
  const som = startOfMonth();
  const today = new Date();
  const toDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // ── Close.com — share cache with SalesDashboard ───────
  const wonQuery = useQuery({
    queryKey: ["close", "won", som],
    queryFn: () => closeFetch(`/opportunity/?_limit=100&pipeline_id=${SALES_PIPELINE}&status_type=won&date_won__gte=${som}`),
    staleTime: 5 * 60 * 1000,
  });

  const lostFullQuery = useQuery({
    queryKey: ["close", "lost-full", som],
    queryFn: () => closeFetch(`/opportunity/?_limit=100&pipeline_id=${SALES_PIPELINE}&status_type=lost&date_lost__gte=${som}`),
    staleTime: 5 * 60 * 1000,
  });

  const pipelineQuery = useQuery({
    queryKey: ["close", "pipeline"],
    queryFn: () => closeFetch(`/opportunity/?_limit=100&pipeline_id=${SALES_PIPELINE}&status_type=active`),
    staleTime: 5 * 60 * 1000,
  });

  const callsQuery = useQuery({
    queryKey: ["close", "calls", som],
    queryFn: () => closeFetch(`/activity/call/?_limit=100&date_created__gte=${som}`),
    staleTime: 5 * 60 * 1000,
  });

  // ── Calendly — this rep's hosted bookings ─────────────
  const calendlyQuery = useQuery({
    queryKey: ["calendly", "events", som, toDate],
    queryFn: () => fetchCalendlyEvents(som, toDate),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading =
    wonQuery.isLoading || lostFullQuery.isLoading ||
    pipelineQuery.isLoading || callsQuery.isLoading || calendlyQuery.isLoading;
  const isError =
    wonQuery.isError || lostFullQuery.isError ||
    pipelineQuery.isError || callsQuery.isError;

  // ── Filter by rep ─────────────────────────────────────
  const repWon      = (wonQuery.data?.data      ?? []).filter((d: { user_name: string }) => d.user_name === rep.closeName);
  const repLost     = (lostFullQuery.data?.data ?? []).filter((d: { user_name: string }) => d.user_name === rep.closeName);
  const repPipeline = (pipelineQuery.data?.data ?? []).filter((d: { user_name: string }) => d.user_name === rep.closeName);
  const repCalls    = (callsQuery.data?.data    ?? []).filter((c: { user_name: string }) => c.user_name === rep.closeName);

  // ── Metrics ───────────────────────────────────────────
  const wonCount      = repWon.length;
  const lostCount     = repLost.length;
  const winRate       = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : null;
  const pipelineCount = repPipeline.length;

  const callsAnswered = repCalls.filter((c: { disposition: string }) => c.disposition === "answered").length;
  const callsTotal    = repCalls.length;
  const showRate      = callsTotal > 0 ? Math.round((callsAnswered / callsTotal) * 100) : null;

  // Average call duration (seconds → mins)
  const avgCallDuration: number | null = (() => {
    const answered = repCalls.filter((c: { disposition: string; duration: number }) => c.disposition === "answered" && c.duration > 0);
    if (!answered.length) return null;
    const avg = answered.reduce((s: number, c: { duration: number }) => s + c.duration, 0) / answered.length;
    return Math.round(avg / 60);
  })();

  // Daily wins
  const dailyWins: { date: string; won: number }[] = (() => {
    const map: Record<string, number> = {};
    repWon.forEach((d: { date_won: string }) => {
      const day = d.date_won?.slice(0, 10);
      if (day) map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, won]) => ({ date, won }));
  })();

  // Pipeline stage breakdown for this rep
  const pipelineByStage: { label: string; count: number }[] = (() => {
    const map: Record<string, number> = {};
    repPipeline.forEach((d: { status_label: string }) => {
      map[d.status_label] = (map[d.status_label] || 0) + 1;
    });
    return Object.entries(map).sort(([, a], [, b]) => b - a).map(([label, count]) => ({ label, count }));
  })();

  // ── Calendly: bookings where this rep is the host ─────
  const repBookings = (calendlyQuery.data ?? []).filter(
    (e: { event_memberships: { user_name: string }[] }) =>
      e.event_memberships?.[0]?.user_name === rep.closeName ||
      e.event_memberships?.[0]?.user_name?.split(" ")[0] === rep.display
  );
  const calendlyBooked = repBookings.length;

  return {
    wonCount, lostCount, winRate,
    pipelineCount, pipelineByStage,
    callsTotal, callsAnswered, showRate, avgCallDuration,
    dailyWins,
    calendlyBooked,
    isLoading, isError,
  };
}
