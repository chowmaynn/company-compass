import { useEffect, useState } from "react";
import { SUPABASE_URL, getSupabaseHeaders } from "@/lib/supabase";

interface XeroReportCell {
  Value: string;
  Attributes?: { Value: string; Id: string }[];
}

interface XeroReportRow {
  RowType: "Header" | "Section" | "Row" | "SummaryRow";
  Title?: string;
  Cells?: XeroReportCell[];
  Rows?: XeroReportRow[];
}

interface XeroReport {
  Reports: {
    ReportID: string;
    ReportName: string;
    ReportTitles: string[];
    Rows: XeroReportRow[];
  }[];
}

interface XeroPLResponse {
  ok: boolean;
  report?: XeroReport;
  error?: string;
}

export interface PLLineItem {
  account: string;
  amount: number;
}

export interface PLSummary {
  fromDate: string;
  toDate: string;
  income: PLLineItem[];
  expenses: PLLineItem[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

async function callXeroPL(fromDate: string, toDate: string): Promise<XeroReport> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/xero-pl`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fromDate, toDate }),
  });
  const data: XeroPLResponse = await res.json();
  if (!data.ok || !data.report) {
    throw new Error(data.error ?? "xero-pl call failed");
  }
  return data.report;
}

function parseLineItems(section: XeroReportRow): PLLineItem[] {
  if (!section.Rows) return [];
  return section.Rows
    .filter((r) => r.RowType === "Row" && r.Cells && r.Cells.length >= 2)
    .map((r) => ({
      account: r.Cells![0].Value,
      amount: parseFloat(r.Cells![1].Value) || 0,
    }));
}

function sectionTotal(section: XeroReportRow | undefined): number {
  if (!section?.Rows) return 0;
  const summary = section.Rows.find((r) => r.RowType === "SummaryRow");
  if (!summary?.Cells || summary.Cells.length < 2) return 0;
  return parseFloat(summary.Cells[1].Value) || 0;
}

/** Find a single-cell value from any flat row across the report (e.g. "Net Profit"). */
function findFlatRowValue(rows: XeroReportRow[], label: string): number | null {
  for (const section of rows) {
    if (!section.Rows) continue;
    for (const r of section.Rows) {
      if (r.RowType === "Row" && r.Cells && r.Cells[0]?.Value === label) {
        return parseFloat(r.Cells[1]?.Value) || 0;
      }
    }
  }
  return null;
}

/**
 * Pulls a Profit & Loss report from Xero (live) and parses it into
 * income/expense line items + totals. fromDate/toDate are YYYY-MM-DD.
 */
export async function fetchProfitAndLoss(fromDate: string, toDate: string): Promise<PLSummary> {
  const report = await callXeroPL(fromDate, toDate);
  const rows = report.Reports[0]?.Rows ?? [];

  const incomeSection = rows.find((r) => r.RowType === "Section" && r.Title === "Income");
  const expenseSection = rows.find(
    (r) => r.RowType === "Section" && r.Title === "Less Operating Expenses",
  );

  const income = parseLineItems(incomeSection ?? { RowType: "Section" });
  // Normalize expense line items to positive values for display — Xero signs
  // them inconsistently across months but the magnitude is what we want.
  const expenses = parseLineItems(expenseSection ?? { RowType: "Section" }).map((r) => ({
    account: r.account,
    amount: Math.abs(r.amount),
  }));

  // Trust Xero's own SummaryRow totals (handles sign quirks correctly).
  const totalIncome = sectionTotal(incomeSection);
  const totalExpenses = Math.abs(sectionTotal(expenseSection));
  const netProfit =
    findFlatRowValue(rows, "Net Profit") ?? totalIncome - totalExpenses;

  return { fromDate, toDate, income, expenses, totalIncome, totalExpenses, netProfit };
}

/** Convert a YYYY-MM string into first-of-month + last-of-month YYYY-MM-DD. */
export function monthToRange(yyyymm: string): { from: string; to: string } | null {
  const m = yyyymm?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 * Live Xero P&L for a given month (YYYY-MM). Single source of truth — used by
 * both the KPI cards and the detailed P&L card so we don't double-fetch.
 */
export function useXeroPL(month: string) {
  const [data, setData] = useState<PLSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const range = monthToRange(month);
    if (!range) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProfitAndLoss(range.from, range.to)
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  return { data, loading, error };
}
