import { useState, useEffect } from "react";
import {
  fetchTransactions,
  fetchFailedPayments,
  fetchCancellationRequests,
  type Transaction,
  type FailedPayment,
  type CancellationRequest,
} from "@/lib/finance";

export interface FinanceData {
  transactions: Transaction[];
  failedPayments: FailedPayment[];
  cancellationRequests: CancellationRequest[];
  loading: boolean;
  error: string | null;
}

export function useFinance(): FinanceData {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [txns, failed, cancels] = await Promise.all([
          fetchTransactions(),
          fetchFailedPayments(),
          fetchCancellationRequests(),
        ]);
        if (cancelled) return;
        setTransactions(txns);
        setFailedPayments(failed);
        setCancellationRequests(cancels);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { transactions, failedPayments, cancellationRequests, loading, error };
}
