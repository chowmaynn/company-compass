import { useQuery } from "@tanstack/react-query";
import { getCurrentWeekIndex, generateWeekConfigs, getCurrentNZMonth } from "@/data/scorecardData";
import { fetchGrowthStats, fetchSubscriberCount, fetchAllBroadcastStats } from "@/lib/kit";

interface KitData {
  weeklyNewSubscribers: (number | "—")[];
  totalSubscribers: number | "—";
  weeklyBroadcastsSent: (number | "—")[];
  weeklyBroadcastOpens: (number | "—")[];
  weeklyBroadcastClicks: (number | "—")[];
  weeklyBroadcastCount: (number | "—")[];
}

const defaultData: KitData = {
  weeklyNewSubscribers: ["—", "—", "—", "—"],
  totalSubscribers: "—",
  weeklyBroadcastsSent: ["—", "—", "—", "—"],
  weeklyBroadcastOpens: ["—", "—", "—", "—"],
  weeklyBroadcastClicks: ["—", "—", "—", "—"],
  weeklyBroadcastCount: ["—", "—", "—", "—"],
};

async function fetchKitData(): Promise<KitData> {
  const weekConfigs = generateWeekConfigs(getCurrentNZMonth());
  const cwi = getCurrentWeekIndex(weekConfigs);

  // Only fetch current week's growth (historical weeks are in Supabase scorecard)
  const currentWeekGrowth = cwi >= 0 && cwi < 4
    ? fetchGrowthStats(
        weekConfigs[cwi].start.split("T")[0],
        weekConfigs[cwi].end.split("T")[0]
      )
    : Promise.resolve(null);

  // Broadcast stats still need all weeks for the scorecard overlay
  const weekRanges = weekConfigs.map((wc) => ({ start: wc.start, end: wc.end }));

  const [growth, broadcastResults, totalSubs] = await Promise.all([
    currentWeekGrowth,
    fetchAllBroadcastStats(weekRanges),
    fetchSubscriberCount(),
  ]);

  const weeklyNewSubscribers: (number | "—")[] = ["—", "—", "—", "—"];
  if (cwi >= 0 && cwi < 4 && growth !== null) {
    weeklyNewSubscribers[cwi] = growth.new_subscribers;
  }

  return {
    weeklyNewSubscribers,
    totalSubscribers: totalSubs ?? "—",
    weeklyBroadcastsSent: broadcastResults.map((b) => b.count > 0 ? b.totalSent : "—"),
    weeklyBroadcastOpens: broadcastResults.map((b) => b.count > 0 ? b.totalOpens : "—"),
    weeklyBroadcastClicks: broadcastResults.map((b) => b.count > 0 ? b.totalClicks : "—"),
    weeklyBroadcastCount: broadcastResults.map((b) => b.count > 0 ? b.count : "—"),
  };
}

export function useKit(): KitData {
  const { data } = useQuery({
    queryKey: ["kit", "broadcasts"],
    queryFn: fetchKitData,
  });

  return data ?? defaultData;
}
