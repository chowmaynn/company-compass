import { useQuery } from "@tanstack/react-query";
import { SUPABASE_URL, supabaseHeaders as headers } from "@/lib/supabase";

async function fetchLatest(metric: string): Promise<{ value: string; month: string } | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/scorecard?metric=eq.${encodeURIComponent(metric)}&order=month.desc&limit=12&select=month,monthly_actual`,
    { headers }
  );
  if (!res.ok) return null;
  const rows: { month: string; monthly_actual: string }[] = await res.json();
  const found = rows.find((r) => r.monthly_actual && r.monthly_actual !== "—");
  return found ? { value: found.monthly_actual, month: found.month } : null;
}

export interface SkoolScorecardData {
  bookingRate: string | null;
  bookingRateMonth: string | null;
  joins: string | null;
  joinsMonth: string | null;
  skoolClicks: string | null;
  skoolClicksMonth: string | null;
  loading: boolean;
}

async function fetchSkoolScorecardData() {
  const [rate, joins, clicks] = await Promise.all([
    fetchLatest("Skool Booking Rate"),
    fetchLatest("Skool Joins"),
    fetchLatest("Clicks: Skool > Accelerator"),
  ]);
  return { rate, joins, clicks };
}

export function useSkoolScorecard(): SkoolScorecardData {
  const query = useQuery({
    queryKey: ["skool-scorecard"],
    queryFn: fetchSkoolScorecardData,
  });

  if (!query.data) {
    return {
      bookingRate: null, bookingRateMonth: null,
      joins: null, joinsMonth: null,
      skoolClicks: null, skoolClicksMonth: null,
      loading: query.isLoading,
    };
  }

  const { rate, joins, clicks } = query.data;
  return {
    bookingRate: rate?.value ?? null,
    bookingRateMonth: rate?.month ?? null,
    joins: joins?.value ?? null,
    joinsMonth: joins?.month ?? null,
    skoolClicks: clicks?.value ?? null,
    skoolClicksMonth: clicks?.month ?? null,
    loading: false,
  };
}
