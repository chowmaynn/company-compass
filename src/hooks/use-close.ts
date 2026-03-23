import { useQuery } from "@tanstack/react-query";

const BASE = "/api/close";

async function closeFetch(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Close API ${res.status}`);
  return res.json();
}

const SALES_PIPELINE = "pipe_0Wd57vBUsq5RErzmTF0IvW";

function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export interface RepStat {
  name: string;
  won: number;
}

export interface DailyWin {
  date: string;
  won: number;
}

export interface PipelineStage {
  label: string;
  count: number;
}

export interface DailyCall {
  date: string;
  answered: number;
  missed: number;
}

export function useClose() {
  const som = startOfMonth();

  const wonQuery = useQuery({
    queryKey: ["close", "won", som],
    queryFn: () =>
      closeFetch(`/opportunity/?_limit=100&pipeline_id=${SALES_PIPELINE}&status_type=won&date_won__gte=${som}`),
    staleTime: 5 * 60 * 1000,
  });

  const lostQuery = useQuery({
    queryKey: ["close", "lost", som],
    queryFn: () =>
      closeFetch(`/opportunity/?_limit=1&pipeline_id=${SALES_PIPELINE}&status_type=lost&date_lost__gte=${som}`),
    staleTime: 5 * 60 * 1000,
  });

  const pipelineQuery = useQuery({
    queryKey: ["close", "pipeline"],
    queryFn: () =>
      closeFetch(`/opportunity/?_limit=100&pipeline_id=${SALES_PIPELINE}&status_type=active`),
    staleTime: 5 * 60 * 1000,
  });

  const callsQuery = useQuery({
    queryKey: ["close", "calls", som],
    queryFn: () =>
      closeFetch(`/activity/call/?_limit=100&date_created__gte=${som}`),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading =
    wonQuery.isLoading || lostQuery.isLoading || pipelineQuery.isLoading || callsQuery.isLoading;
  const isError =
    wonQuery.isError || lostQuery.isError || pipelineQuery.isError || callsQuery.isError;

  // Won deals this month
  const wonCount: number = wonQuery.data?.total_results ?? 0;
  const lostCount: number = lostQuery.data?.total_results ?? 0;
  const winRate: number | null =
    wonCount + lostCount > 0
      ? Math.round((wonCount / (wonCount + lostCount)) * 100)
      : null;

  // Rep leaderboard
  const repStats: RepStat[] = (() => {
    if (!wonQuery.data?.data) return [];
    const map: Record<string, number> = {};
    wonQuery.data.data.forEach((o: { user_name: string }) => {
      if (!o.user_name || o.user_name === "AAA Accelerator") return;
      map[o.user_name] = (map[o.user_name] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([name, won]) => ({ name, won }));
  })();

  // Daily wins
  const dailyWins: DailyWin[] = (() => {
    if (!wonQuery.data?.data) return [];
    const map: Record<string, number> = {};
    wonQuery.data.data.forEach((o: { date_won: string }) => {
      const day = o.date_won?.slice(0, 10);
      if (day) map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, won]) => ({ date, won }));
  })();

  // Pipeline stages
  const pipelineStages: PipelineStage[] = (() => {
    if (!pipelineQuery.data?.data) return [];
    const stageOrder = ["Lead In", "Call Booked", "Call Completed", "Follow-up In Progress"];
    const map: Record<string, number> = {};
    pipelineQuery.data.data.forEach((o: { status_label: string }) => {
      map[o.status_label] = (map[o.status_label] || 0) + 1;
    });
    const ordered = stageOrder
      .filter((s) => map[s])
      .map((label) => ({ label, count: map[label] }));
    const rest = Object.entries(map)
      .filter(([l]) => !stageOrder.includes(l))
      .map(([label, count]) => ({ label, count }));
    return [...ordered, ...rest];
  })();

  // Call activity — count directly from fetched data (Close doesn't return total_results)
  const callData: { date_created: string; disposition: string }[] = callsQuery.data?.data ?? [];
  const callsTotal: number = callData.length;
  const callsAnswered: number = callData.filter((c) => c.disposition === "answered").length;
  const showRate: number | null =
    callsTotal > 0 ? Math.round((callsAnswered / callsTotal) * 100) : null;

  const dailyCalls: DailyCall[] = (() => {
    if (!callData.length) return [];
    const map: Record<string, { answered: number; missed: number }> = {};
    callData.forEach((c) => {
      const day = c.date_created.slice(0, 10);
      if (!map[day]) map[day] = { answered: 0, missed: 0 };
      if (c.disposition === "answered") map[day].answered++;
      else map[day].missed++;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
  })();

  // Recent won deals
  const recentWon = wonQuery.data?.data?.slice(0, 6) ?? [];

  return {
    wonCount,
    lostCount,
    winRate,
    callsTotal,
    callsAnswered,
    showRate,
    repStats,
    dailyWins,
    pipelineStages,
    dailyCalls,
    recentWon,
    isLoading,
    isError,
  };
}
