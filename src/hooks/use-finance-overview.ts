import { useQuery } from "@tanstack/react-query";
import { fetchFinanceMonthly, type FinanceMonthly } from "@/lib/supabase-finance";

export type { FinanceMonthly };

export function useFinanceOverview() {
  const query = useQuery({
    queryKey: ["finance-monthly"],
    queryFn: fetchFinanceMonthly,
    staleTime: 10 * 60 * 1000,
  });

  return {
    data: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
  };
}
