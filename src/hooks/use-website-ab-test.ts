import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchVariantVisitors } from "@/lib/google-analytics";
import { useSupabaseMetrics } from "@/hooks/use-supabase-metrics";

export interface VariantData {
  visitors: number;
  bookings: number;
  conversionRate: number;
}

export interface ABTestData {
  variants: {
    A: VariantData;
    B: VariantData;
    C: VariantData;
  };
  totalWebsiteBookings: number;
  winner: "A" | "B" | "C" | null;
  loading: boolean;
  error: string | null;
}

// Calendly event names for each variant in the Supabase data cube
const VARIANT_EVENT_NAMES = {
  A: "AAA Accelerator Business Call (Website)",
  B: "AAA Accelerator Business Call (Website B)",
  C: "AAA Accelerator Business Call (Website C)",
};

export function useWebsiteABTest(startDate: string, endDate: string, startISO?: string, endISO?: string): ABTestData {
  // GA4 visitors by variant (uses YYYY-MM-DD dates)
  const gaQuery = useQuery({
    queryKey: ["ga4", "variants", startDate, endDate],
    queryFn: () => fetchVariantVisitors(startDate, endDate),
    staleTime: 5 * 60 * 1000,
    enabled: !!startDate && !!endDate,
  });

  // Bookings from Casey's Supabase (uses ISO strings for consistency with other sections)
  const safeStartISO = startISO || (startDate ? new Date(startDate).toISOString() : new Date().toISOString());
  const safeEndISO = endISO || (endDate ? new Date(endDate + "T23:59:59").toISOString() : new Date().toISOString());
  const supabase = useSupabaseMetrics(safeStartISO, safeEndISO);

  // GA4 visitor counts per variant
  const visitorMap = useMemo(() => {
    const map: Record<string, number> = {};
    (gaQuery.data ?? []).forEach((r) => {
      map[r.variant] = (map[r.variant] || 0) + r.visitors;
    });
    return map;
  }, [gaQuery.data]);

  // Booking counts per variant from Supabase event breakdown
  const bookingMap = useMemo(() => {
    const breakdown = supabase.salesEventBreakdown ?? [];
    const getQualified = (shortName: string) =>
      breakdown.find((e) => e.name === shortName)?.qualified ?? 0;

    return {
      A: getQualified("Website"),
      B: getQualified("Website B"),
      C: getQualified("Website C"),
    };
  }, [supabase.salesEventBreakdown]);

  const makeVariant = (key: "A" | "B" | "C"): VariantData => {
    const visitors = visitorMap[key] || 0;
    const bookings = bookingMap[key];
    return {
      visitors,
      bookings,
      conversionRate: visitors > 0 ? (bookings / visitors) * 100 : 0,
    };
  };

  const variants = {
    A: makeVariant("A"),
    B: makeVariant("B"),
    C: makeVariant("C"),
  };

  const totalWebsiteBookings = variants.A.bookings + variants.B.bookings + variants.C.bookings;

  // Determine winner (highest conversion rate with at least some visitors)
  let winner: "A" | "B" | "C" | null = null;
  let bestRate = 0;
  for (const [key, data] of Object.entries(variants) as [keyof typeof variants, VariantData][]) {
    if (data.visitors >= 10 && data.conversionRate > bestRate) {
      bestRate = data.conversionRate;
      winner = key;
    }
  }

  return {
    variants,
    totalWebsiteBookings,
    winner,
    loading: gaQuery.isLoading || supabase.isLoading,
    error: gaQuery.error ? String(gaQuery.error) : null,
  };
}
