import { Card, CardContent } from "@/components/ui/card";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import type { PLSummary } from "@/lib/xero";

interface XeroPLProps {
  month: string;
  pl: PLSummary | null;
  loading: boolean;
  error: string | null;
  convert: (v: number) => number;
  symbol: string;
}

function fmt(symbol: string, n: number): string {
  return `${n < 0 ? "-" : ""}${symbol}${Math.abs(n).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
}

export function XeroPL({ month, pl, loading, error, convert, symbol }: XeroPLProps) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Xero — Profit & Loss</h3>
            <p className="text-xs text-muted-foreground">
              Live from Xero · {month || "—"}
            </p>
          </div>
        </div>

        {loading && <LoadingIndicator />}
        {error && <p className="text-xs text-red-600">{error}</p>}

        {pl && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Breakdown title="Income" rows={pl.income} convert={convert} symbol={symbol} />
            <Breakdown title="Expenses" rows={pl.expenses} convert={convert} symbol={symbol} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Breakdown({
  title,
  rows,
  convert,
  symbol,
}: {
  title: string;
  rows: { account: string; amount: number }[];
  convert: (v: number) => number;
  symbol: string;
}) {
  if (!rows.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</h4>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.account} className="flex justify-between text-sm">
            <span className="text-foreground">{r.account}</span>
            <span className="text-muted-foreground tabular-nums">{fmt(symbol, convert(r.amount))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
