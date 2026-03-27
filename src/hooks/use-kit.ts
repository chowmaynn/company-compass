import { useQuery } from "@tanstack/react-query";
import { weekConfigs } from "@/data/scorecardData";
import { fetchGrowthStats, fetchSubscriberCount, fetchAllBroadcastStats } from "@/lib/kit";

interface KitData {
  /** New subscribers gained per week (W1–W4) */
  weeklyNewSubscribers: (number | "—")[];
  /** Total active subscriber count (snapshot) */
  totalSubscribers: number | "—";
  /** Broadcast emails sent per week */
  weeklyBroadcastsSent: (number | "—")[];
  /** Broadcast email opens per week */
  weeklyBroadcastOpens: (number | "—")[];
  /** Broadcast email clicks per week */
  weeklyBroadcastClicks: (number | "—")[];
  /** Number of broadcasts sent per week */
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
  const weekRanges = weekConfigs.map((wc) => ({
    start: wc.start,
    end: wc.end,
  }));

  const growthPromises = weekConfigs.map((wc) => {
    const start = wc.start.split("T")[0];
    const end = wc.end.split("T")[0];
    return fetchGrowthStats(start, end);
  });

  const [growthResults, broadcastResults, totalSubs] = await Promise.all([
    Promise.all(growthPromises),
    fetchAllBroadcastStats(weekRanges),
    fetchSubscriberCount(),
  ]);

  return {
    weeklyNewSubscribers: growthResults.map((g) =>
      g !== null ? g.new_subscribers : "—"
    ),
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
    staleTime: 5 * 60 * 1000,
  });

  return data ?? defaultData;
}
