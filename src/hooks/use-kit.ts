import { useState, useEffect } from "react";
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

export function useKit() {
  const [data, setData] = useState<KitData>({
    weeklyNewSubscribers: ["—", "—", "—", "—"],
    totalSubscribers: "—",
    weeklyBroadcastsSent: ["—", "—", "—", "—"],
    weeklyBroadcastOpens: ["—", "—", "—", "—"],
    weeklyBroadcastClicks: ["—", "—", "—", "—"],
    weeklyBroadcastCount: ["—", "—", "—", "—"],
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Fetch all data in parallel (7 API calls total, well under 120/min limit)
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

        if (cancelled) return;

        setData({
          weeklyNewSubscribers: growthResults.map((g) =>
            g !== null ? g.new_subscribers : "—"
          ),
          totalSubscribers: totalSubs ?? "—",
          weeklyBroadcastsSent: broadcastResults.map((b) => b.count > 0 ? b.totalSent : "—"),
          weeklyBroadcastOpens: broadcastResults.map((b) => b.count > 0 ? b.totalOpens : "—"),
          weeklyBroadcastClicks: broadcastResults.map((b) => b.count > 0 ? b.totalClicks : "—"),
          weeklyBroadcastCount: broadcastResults.map((b) => b.count > 0 ? b.count : "—"),
        });
      } catch (err) {
        console.error("Kit fetch error:", err);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return data;
}
