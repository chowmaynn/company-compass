import { useState, useEffect } from "react";
import {
  fetchBroadcastsInRange,
  fetchGrowthStats,
  fetchSubscriberCount,
  type BroadcastItem,
} from "@/lib/kit";

export type { BroadcastItem };

export interface KitMarketingData {
  /** True engaged subs = active − cold */
  trueActiveSubscribers: number | null;
  /** Approx cold subs = active − max(recipients from full-list sends ≥ 80K) */
  coldSubscribers: number | null;
  /** Total active (engaged + cold) — used as "Total List" */
  activeSubscribers: number | null;
  unsubscribed: number | null;
  totalSubscribers: number | null;
  newSubscribers: number | null;
  cancelledSubscribers: number | null;
  broadcasts: BroadcastItem[];
  totalRecipients: number;
  totalOpens: number;
  totalCalendlyClicks: number;
  // Rates are already in percentage form (e.g. 38.53 = 38.53%)
  avgOpenRate: number | null;
  avgClickRate: number | null;
  loading: boolean;
}

export function useKitMarketing(startDate: string, endDate: string): KitMarketingData {
  const [data, setData] = useState<KitMarketingData>({
    trueActiveSubscribers: null,
    coldSubscribers: null,
    activeSubscribers: null,
    unsubscribed: null,
    totalSubscribers: null,
    newSubscribers: null,
    cancelledSubscribers: null,
    broadcasts: [],
    totalRecipients: 0,
    totalOpens: 0,
    totalCalendlyClicks: 0,
    avgOpenRate: null,
    avgClickRate: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setData((d) => ({ ...d, loading: true }));

    async function load() {
      try {
        const [broadcastsResult, growth, activeSubs, unsubSubs] = await Promise.all([
          fetchBroadcastsInRange(startDate, endDate),
          fetchGrowthStats(startDate, endDate),
          fetchSubscriberCount("active"),
          fetchSubscriberCount("cancelled"),
        ]);

        if (cancelled) return;

        const { broadcasts, fullListRecipientCounts } = broadcastsResult;

        // cold ≈ active − warmListSize
        // warmListSize = max(counts where count < active * 0.80)
        // The 0.80 cap excludes combined warm+cold sends (which approach ~100% of active subs)
        const warmOnlyCounts = activeSubs != null
          ? fullListRecipientCounts.filter((n) => n < activeSubs * 0.80)
          : fullListRecipientCounts;
        const warmListSize = warmOnlyCounts.length > 0 ? Math.max(...warmOnlyCounts) : null;

        const coldSubscribers =
          activeSubs != null && warmListSize != null
            ? activeSubs - warmListSize
            : null;
        const trueActiveSubscribers =
          activeSubs != null && coldSubscribers != null
            ? activeSubs - coldSubscribers
            : activeSubs;

        // Exclude drafts from all broadcast-level metrics
        const sentBroadcasts = broadcasts.filter((b) => b.opens > 0);
        const totalRecipients = sentBroadcasts.reduce((s, b) => s + b.recipients, 0);
        const totalOpens = sentBroadcasts.reduce((s, b) => s + b.opens, 0);
        const totalCalendlyClicks = sentBroadcasts.reduce((s, b) => s + b.calendlyClicks, 0);
        const periodUnsubscribes = sentBroadcasts.reduce((s, b) => s + b.unsubscribes, 0);

        const avgOpenRate =
          sentBroadcasts.length > 0
            ? sentBroadcasts.reduce((s, b) => s + b.openRate, 0) / sentBroadcasts.length
            : null;
        const avgClickRate =
          sentBroadcasts.length > 0
            ? sentBroadcasts.reduce((s, b) => s + b.clickRate, 0) / sentBroadcasts.length
            : null;

        setData({
          trueActiveSubscribers,
          coldSubscribers,
          activeSubscribers: activeSubs,
          unsubscribed: unsubSubs,
          totalSubscribers: activeSubs,
          newSubscribers: growth?.new_subscribers ?? null,
          cancelledSubscribers: periodUnsubscribes,
          broadcasts: sentBroadcasts,
          totalRecipients,
          totalOpens,
          totalCalendlyClicks,
          avgOpenRate,
          avgClickRate,
          loading: false,
        });
      } catch (err) {
        console.error("KIT marketing fetch error:", err);
        if (!cancelled) setData((d) => ({ ...d, loading: false }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startDate, endDate]);

  return data;
}
