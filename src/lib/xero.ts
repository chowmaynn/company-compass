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

export interface PLTrendPoint {
  month: string; // YYYY-MM
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
}

/**
 * Parse a Xero P&L header cell like "31 May 26" into a YYYY-MM month string.
 * Xero localizes these; en-NZ format is "31 May 26".
 */
function headerCellToMonth(value: string): string | null {
  const m = value?.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})/);
  if (!m) return null;
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const idx = monthNames.findIndex((n) => n.toLowerCase() === m[2].toLowerCase().slice(0,3));
  if (idx < 0) return null;
  const yr = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${yr}-${String(idx + 1).padStart(2, "0")}`;
}

/**
 * Fetch a multi-period P&L in a single API call (Xero's `periods` + `timeframe`).
 * Returns one PLTrendPoint per month column. `fromDate`/`toDate` must bound the
 * *newest* month (first→last of month); Xero adds `periods` more months going
 * backwards as additional columns.
 */
export async function fetchProfitAndLossPeriods(
  fromDate: string,
  toDate: string,
  periods: number,
): Promise<PLTrendPoint[]> {
  const headers = await getSupabaseHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/xero-pl`, {
    method: "POST",
    headers,
    body: JSON.stringify({ fromDate, toDate, periods, timeframe: "MONTH" }),
  });
  const data = await res.json();
  if (!data.ok || !data.report) {
    throw new Error(data.error ?? "xero-pl periods call failed");
  }
  const rows: XeroReportRow[] = data.report.Reports[0]?.Rows ?? [];

  // 1. Header row → month per column (column 0 is the account label, skip it)
  const headerRow = rows.find((r) => r.RowType === "Header");
  const monthByCol: (string | null)[] = (headerRow?.Cells ?? []).map((c, i) =>
    i === 0 ? null : headerCellToMonth(c.Value),
  );

  // 2. SummaryRows for Income and Operating Expenses sections give totals/period
  const incomeSection = rows.find((r) => r.RowType === "Section" && r.Title === "Income");
  const expenseSection = rows.find(
    (r) => r.RowType === "Section" && r.Title === "Less Operating Expenses",
  );
  const incomeSummary = incomeSection?.Rows?.find((r) => r.RowType === "SummaryRow");
  const expenseSummary = expenseSection?.Rows?.find((r) => r.RowType === "SummaryRow");

  // 3. Net Profit row (flat row at the end)
  let netProfitRow: XeroReportRow | undefined;
  for (const section of rows) {
    if (!section.Rows) continue;
    const found = section.Rows.find(
      (r) => r.RowType === "Row" && r.Cells?.[0]?.Value === "Net Profit",
    );
    if (found) { netProfitRow = found; break; }
  }

  // 4. Stitch one PLTrendPoint per column
  const points: PLTrendPoint[] = [];
  for (let i = 1; i < monthByCol.length; i++) {
    const month = monthByCol[i];
    if (!month) continue;
    const totalIncome = parseFloat(incomeSummary?.Cells?.[i]?.Value ?? "0") || 0;
    const totalExpenses = Math.abs(parseFloat(expenseSummary?.Cells?.[i]?.Value ?? "0") || 0);
    const netProfit = netProfitRow
      ? parseFloat(netProfitRow.Cells?.[i]?.Value ?? "0") || 0
      : totalIncome - totalExpenses;
    points.push({ month, totalIncome, totalExpenses, netProfit });
  }
  return points;
}

// Xero limits `periods` to 1..11, so each call returns at most 12 monthly
// columns. For trends longer than 12 months we chunk into parallel calls.
const MAX_PERIODS_PER_CALL = 11;

/** Step a YYYY-MM string back by N months. */
function addMonths(yyyymm: string, delta: number): string | null {
  const m = yyyymm.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Trend hook — fetches N months from Xero, chunked into multiple `periods`
 * calls (max 12 months per call). `endMonth` is YYYY-MM (most recent), `count`
 * is how many months back to include.
 */
export function useXeroPLTrend(endMonth: string, count: number) {
  const [data, setData] = useState<PLTrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!endMonth || count <= 0) {
      setData([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Build chunk boundaries — each chunk anchors on a different month and
    // requests up to MAX_PERIODS_PER_CALL prior periods.
    const chunks: { from: string; to: string; periods: number }[] = [];
    let remaining = count;
    let chunkEndMonth: string | null = endMonth;
    while (remaining > 0 && chunkEndMonth) {
      const monthsThisChunk = Math.min(remaining, MAX_PERIODS_PER_CALL + 1);
      const range = monthToRange(chunkEndMonth);
      if (!range) break;
      chunks.push({ from: range.from, to: range.to, periods: monthsThisChunk - 1 });
      remaining -= monthsThisChunk;
      chunkEndMonth = addMonths(chunkEndMonth, -monthsThisChunk);
    }

    Promise.all(
      chunks.map((c) =>
        fetchProfitAndLossPeriods(c.from, c.to, c.periods).catch(() => [] as PLTrendPoint[]),
      ),
    )
      .then((chunkResults) => {
        if (cancelled) return;
        // Dedupe by month, prefer earlier (more recent-anchored) chunk.
        const byMonth = new Map<string, PLTrendPoint>();
        for (const chunk of chunkResults) {
          for (const p of chunk) {
            if (!byMonth.has(p.month)) byMonth.set(p.month, p);
          }
        }
        // Sort newest first to match how the rest of the app orders months.
        const merged = Array.from(byMonth.values()).sort((a, b) =>
          a.month < b.month ? 1 : a.month > b.month ? -1 : 0,
        );
        setData(merged);
      })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [endMonth, count]);

  return { data, loading, error };
}

/**
 * Live Xero P&L for an arbitrary date range. Used by the KPI cards so they
 * reflect whatever preset (This Month / Last Month / 3 Months / Custom) is
 * active. Xero will aggregate the range into a single P&L report.
 */
export function useXeroPL(fromDate: string, toDate: string) {
  const [data, setData] = useState<PLSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fromDate || !toDate) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProfitAndLoss(fromDate, toDate)
      .then((r) => { if (!cancelled) setData(r); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fromDate, toDate]);

  return { data, loading, error };
}
