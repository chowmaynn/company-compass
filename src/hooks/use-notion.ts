import { useQuery } from "@tanstack/react-query";
import { weekConfigs } from "@/data/scorecardData";
import { fetchBacklogCount, fetchPublishedCount } from "@/lib/notion";

interface NotionData {
  /** Videos published per week (W1–W4) */
  weeklyPublished: (number | "—")[];
  /** Current backlog count (snapshot) */
  backlogCount: number | "—";
}

const defaultData: NotionData = {
  weeklyPublished: ["—", "—", "—", "—"],
  backlogCount: "—",
};

async function fetchNotionData(): Promise<NotionData> {
  const publishedPromises = weekConfigs.map((wc) => {
    const start = wc.start.split("T")[0];
    const end = wc.end.split("T")[0];
    return fetchPublishedCount(start, end);
  });

  const backlogPromise = fetchBacklogCount();

  const [published, backlog] = await Promise.all([
    Promise.all(publishedPromises),
    backlogPromise,
  ]);

  return {
    weeklyPublished: published,
    backlogCount: backlog,
  };
}

export function useNotion(): NotionData {
  const { data } = useQuery({
    queryKey: ["notion", "content"],
    queryFn: fetchNotionData,
    staleTime: 5 * 60 * 1000,
  });

  return data ?? defaultData;
}
