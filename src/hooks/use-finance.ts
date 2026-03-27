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

  const airtableQuery = useQuery({
    queryKey: ["finance", "airtable", afterDate],
    queryFn: () => Promise.all([
      fetchTransactions(afterDate),
      fetchFailedPayments(),
      fetchCancellationRequests(afterDate),
    ]),
    staleTime: 5 * 60 * 1000,
  });

  const stripeQuery = useQuery({
    queryKey: ["finance", "stripe", startTs, endTs],
    queryFn: () => fetchStripeOverview(startTs, endTs),
    staleTime: 5 * 60 * 1000,
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
