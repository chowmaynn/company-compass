import { useQuery } from "@tanstack/react-query";
import {
  fetchTransactions,
  fetchFailedPayments,
  fetchCancellationRequests,
  fetchStripeOverview,
  type Transaction,
  type FailedPayment,
  type CancellationRequest,
  type StripeOverview,
} from "@/lib/finance";

export interface FinanceData {
  transactions: Transaction[];
  failedPayments: FailedPayment[];
  cancellationRequests: CancellationRequest[];
  stripeOverview: StripeOverview | null;
  loading: boolean;
  stripeLoading: boolean;
  error: string | null;
}

export function useFinance(startTs: number, endTs: number): FinanceData {
  const afterDate = new Date(startTs * 1000).toISOString().split("T")[0];

  // Round timestamps to day boundaries for stable query keys
  const startDay = Math.floor(startTs / 86400) * 86400;
  const endDay = Math.floor(endTs / 86400) * 86400 + 86399;

  const airtableQuery = useQuery({
    queryKey: ["finance", "airtable", afterDate],
    queryFn: () => Promise.all([
      fetchTransactions(afterDate),
      fetchFailedPayments(),
      fetchCancellationRequests(afterDate),
    ]),
  });

  const stripeQuery = useQuery({
    queryKey: ["finance", "stripe", startDay, endDay],
    queryFn: () => fetchStripeOverview(startTs, endTs),
  });

  const [transactions, failedPayments, cancellationRequests] = airtableQuery.data ?? [[], [], []];

  return {
    transactions,
    failedPayments,
    cancellationRequests,
    stripeOverview: stripeQuery.data ?? null,
    loading: airtableQuery.isLoading,
    stripeLoading: stripeQuery.isLoading,
    error: airtableQuery.error ? String(airtableQuery.error) : stripeQuery.error ? String(stripeQuery.error) : null,
  };
}
