import { useState, useEffect } from "react";
import { weekConfigs } from "@/data/scorecardData";
import { fetchBacklogCount, fetchPublishedCount } from "@/lib/notion";

interface NotionData {
  /** Videos published per week (W1–W4) */
  weeklyPublished: (number | "—")[];
  /** Current backlog count (snapshot) */
  backlogCount: number | "—";
}

export function useNotion() {
  const [data, setData] = useState<NotionData>({
    weeklyPublished: ["—", "—", "—", "—"],
    backlogCount: "—",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Fetch published counts per week in parallel
        const publishedPromises = weekConfigs.map((wc) => {
          const start = wc.start.split("T")[0]; // "2026-03-01"
          const end = wc.end.split("T")[0];     // "2026-03-08"
          return fetchPublishedCount(start, end);
        });

        const backlogPromise = fetchBacklogCount();

        const [published, backlog] = await Promise.all([
          Promise.all(publishedPromises),
          backlogPromise,
        ]);

        if (cancelled) return;

        setData({
          weeklyPublished: published,
          backlogCount: backlog,
        });
      } catch (err) {
        console.error("Notion fetch error:", err);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return data;
}
