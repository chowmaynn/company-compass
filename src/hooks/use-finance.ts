import { useState, useEffect } from "react";
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequest[]>([]);
  const [stripeOverview, setStripeOverview] = useState<StripeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [stripeLoading, setStripeLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Airtable data — load once
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchTransactions(), fetchFailedPayments(), fetchCancellationRequests()])
      .then(([txns, failed, cancels]) => {
        if (cancelled) return;
        setTransactions(txns);
        setFailedPayments(failed);
        setCancellationRequests(cancels);
      })
      .catch((err) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Stripe data — reload when date range changes
  useEffect(() => {
    let cancelled = false;
    setStripeLoading(true);
    fetchStripeOverview(startTs, endTs)
      .then((data) => { if (!cancelled) setStripeOverview(data); })
      .catch((err) => { if (!cancelled) setError(String(err)); })
      .finally(() => { if (!cancelled) setStripeLoading(false); });
    return () => { cancelled = true; };
  }, [startTs, endTs]);

  return { transactions, failedPayments, cancellationRequests, stripeOverview, loading, stripeLoading, error };
}
