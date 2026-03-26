import { useState, useEffect } from "react";

const SUPABASE_URL = import.meta.env.VITE_SCORECARD_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SCORECARD_SUPABASE_ANON_KEY;

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

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

export function useSkoolScorecard(): SkoolScorecardData {
  const [data, setData] = useState<SkoolScorecardData>({
    bookingRate: null, bookingRateMonth: null,
    joins: null, joinsMonth: null,
    skoolClicks: null, skoolClicksMonth: null,
    loading: true,
  });

  useEffect(() => {
    Promise.all([
      fetchLatest("Skool Booking Rate"),
      fetchLatest("Skool Joins"),
      fetchLatest("Clicks: Skool > Accelerator"),
    ]).then(([rate, joins, clicks]) => {
      setData({
        bookingRate: rate?.value ?? null,
        bookingRateMonth: rate?.month ?? null,
        joins: joins?.value ?? null,
        joinsMonth: joins?.month ?? null,
        skoolClicks: clicks?.value ?? null,
        skoolClicksMonth: clicks?.month ?? null,
        loading: false,
      });
    });
  }, []);

  return data;
}
