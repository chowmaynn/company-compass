import { useQuery } from "@tanstack/react-query";
import { startOfMonthDate } from "@/lib/dates";
import { SALES_PIPELINE_ID } from "@/lib/constants";
import { closePaginateAll } from "@/lib/close";

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
  const som = startOfMonthDate();

  // Won deals — paginated, shared cache key with RepMetrics
  const wonQuery = useQuery({
    queryKey: ["close", "won", som],
    queryFn: () =>
      closePaginateAll(`/opportunity/?pipeline_id=${SALES_PIPELINE_ID}&status_type=won&date_won__gte=${som}`),
    staleTime: 5 * 60 * 1000,
  });

  // Lost deals — full records (shared with RepMetrics)
  const lostQuery = useQuery({
    queryKey: ["close", "lost-full", som],
    queryFn: () =>
      closePaginateAll(`/opportunity/?pipeline_id=${SALES_PIPELINE_ID}&status_type=lost&date_lost__gte=${som}`),
    staleTime: 5 * 60 * 1000,
  });

  // Active pipeline — paginated, date-filtered to deals created in last 90 days
  const pipelineQuery = useQuery({
    queryKey: ["close", "pipeline"],
    queryFn: () =>
      closePaginateAll(`/opportunity/?pipeline_id=${SALES_PIPELINE_ID}&status_type=active`),
    staleTime: 5 * 60 * 1000,
  });

  // Call activity — paginated
  const callsQuery = useQuery({
    queryKey: ["close", "calls", som],
    queryFn: () =>
      closePaginateAll(`/activity/call/?date_created__gte=${som}`),
    staleTime: 5 * 60 * 1000,
  });

  const isLoading =
    wonQuery.isLoading || lostQuery.isLoading || pipelineQuery.isLoading || callsQuery.isLoading;
  const isError =
    wonQuery.isError || lostQuery.isError || pipelineQuery.isError || callsQuery.isError;

  // Won/lost counts
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

  // Call activity
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
