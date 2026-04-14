import { SUPABASE_URL, getSupabaseHeaders } from "@/lib/supabase";

export interface FinanceMonthly {
  id: string;
  month: string;
  revenue: number | null;
  cogs: number | null;
  coaching_contractors: number | null;
  subscriptions: number | null;
  gross_margin_pct: number | null;
  product_cost_ratio_pct: number | null;
  headcount: number | null;
  revenue_per_employee: number | null;
  revenue_target: number | null;
  revenue_per_employee_target: number | null;
}

export async function fetchFinanceMonthly(): Promise<FinanceMonthly[]> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/finance_monthly?select=*&order=month.desc`,
    { headers }
  );
  if (!res.ok) return [];
  return res.json();
}
