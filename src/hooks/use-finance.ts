import { useState, useEffect } from "react";
import {
  fetchTransactions,
  fetchMembers,
  fetchFailedPayments,
  fetchCancellationRequests,
  fetchRecentCharges,
  type Transaction,
  type Member,
  type FailedPayment,
  type CancellationRequest,
  type StripeCharge,
} from "@/lib/finance";

export interface FinanceData {
  transactions: Transaction[];
  members: Member[];
  failedPayments: FailedPayment[];
  cancellationRequests: CancellationRequest[];
  recentCharges: StripeCharge[];
  loading: boolean;
  error: string | null;
}

export function useFinance(): FinanceData {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [failedPayments, setFailedPayments] = useState<FailedPayment[]>([]);
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequest[]>([]);
  const [recentCharges, setRecentCharges] = useState<StripeCharge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [txns, mems, failed, cancels, charges] = await Promise.all([
          fetchTransactions(),
          fetchMembers(),
          fetchFailedPayments(),
          fetchCancellationRequests(),
          fetchRecentCharges(50),
        ]);
        if (cancelled) return;
        setTransactions(txns);
        setMembers(mems);
        setFailedPayments(failed);
        setCancellationRequests(cancels);
        setRecentCharges(charges);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { transactions, members, failedPayments, cancellationRequests, recentCharges, loading, error };
}
