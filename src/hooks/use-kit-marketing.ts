import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchBroadcastsInRange,
  fetchGrowthStats,
  fetchSubscriberCount,
  type BroadcastItem,
} from "@/lib/kit";

export type { BroadcastItem };

export interface KitMarketingData {
  trueActiveSubscribers: number | null;
  coldSubscribers: number | null;
  activeSubscribers: number | null;
  unsubscribed: number | null;
  totalSubscribers: number | null;
  newSubscribers: number | null;
  cancelledSubscribers: number | null;
  broadcasts: BroadcastItem[];
  totalRecipients: number;
  totalOpens: number;
  totalCalendlyClicks: number;
  avgOpenRate: number | null;
  avgClickRate: number | null;
  loading: boolean;
}

async function fetchKitMarketingData(startDate: string, endDate: string) {
  const [broadcastsResult, growth, activeSubs, unsubSubs] = await Promise.all([
    fetchBroadcastsInRange(startDate, endDate),
    fetchGrowthStats(startDate, endDate),
    fetchSubscriberCount("active"),
    fetchSubscriberCount("cancelled"),
  ]);

  return { broadcastsResult, growth, activeSubs, unsubSubs };
}

export function useKitMarketing(startDate: string, endDate: string): KitMarketingData {
  const query = useQuery({
    queryKey: ["kit-marketing", startDate, endDate],
    queryFn: () => fetchKitMarketingData(startDate, endDate),
    enabled: !!startDate && !!endDate,
  });

  return useMemo(() => {
    if (!query.data) {
      return {
        trueActiveSubscribers: null, coldSubscribers: null, activeSubscribers: null,
        unsubscribed: null, totalSubscribers: null, newSubscribers: null,
        cancelledSubscribers: null, broadcasts: [], totalRecipients: 0,
        totalOpens: 0, totalCalendlyClicks: 0, avgOpenRate: null, avgClickRate: null,
        loading: query.isLoading,
      };
    }

    const { broadcastsResult, growth, activeSubs, unsubSubs } = query.data;
    const { broadcasts, fullListRecipientCounts } = broadcastsResult;

    const warmOnlyCounts = activeSubs != null
      ? fullListRecipientCounts.filter((n) => n < activeSubs * 0.80)
      : fullListRecipientCounts;
    const warmListSize = warmOnlyCounts.length > 0 ? Math.max(...warmOnlyCounts) : null;

    const coldSubscribers =
      activeSubs != null && warmListSize != null ? activeSubs - warmListSize : null;
    const trueActiveSubscribers =
      activeSubs != null && coldSubscribers != null ? activeSubs - coldSubscribers : activeSubs;

    const sentBroadcasts = broadcasts.filter((b) => b.opens > 0);
    const totalRecipients = sentBroadcasts.reduce((s, b) => s + b.recipients, 0);
    const totalOpens = sentBroadcasts.reduce((s, b) => s + b.opens, 0);
    const totalCalendlyClicks = sentBroadcasts.reduce((s, b) => s + b.calendlyClicks, 0);
    const periodUnsubscribes = sentBroadcasts.reduce((s, b) => s + b.unsubscribes, 0);

    const avgOpenRate = sentBroadcasts.length > 0
      ? sentBroadcasts.reduce((s, b) => s + b.openRate, 0) / sentBroadcasts.length : null;
    const avgClickRate = sentBroadcasts.length > 0
      ? sentBroadcasts.reduce((s, b) => s + b.clickRate, 0) / sentBroadcasts.length : null;

    return {
      trueActiveSubscribers, coldSubscribers, activeSubscribers: activeSubs,
      unsubscribed: unsubSubs, totalSubscribers: activeSubs,
      newSubscribers: growth?.new_subscribers ?? null,
      cancelledSubscribers: periodUnsubscribes,
      broadcasts: sentBroadcasts, totalRecipients, totalOpens, totalCalendlyClicks,
      avgOpenRate, avgClickRate, loading: false,
    };
  }, [query.data, query.isLoading]);
}
