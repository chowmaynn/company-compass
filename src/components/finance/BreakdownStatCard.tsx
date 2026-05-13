import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingIndicator } from "@/components/LoadingIndicator";

export interface BreakdownLine {
  account: string;
  amount: number;
}

interface BreakdownStatCardProps {
  label: string;
  value: string | React.ReactNode;
  sub?: string;
  icon?: React.ElementType;
  accent?: string;
  bg?: string;
  loading?: boolean;
  /** Line items shown when the card is expanded. */
  lines: BreakdownLine[];
  /** Formats a raw amount into the display string (e.g. "$1,234"). */
  format: (n: number) => string;
}

export function BreakdownStatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  bg,
  loading,
  lines,
  format,
}: BreakdownStatCardProps) {
  const [open, setOpen] = useState(false);
  const textColor = accent ?? "text-foreground";
  const hasLines = lines.length > 0;

  return (
    <Card className="border-border/50 overflow-hidden">
      <button
        type="button"
        disabled={!hasLines}
        onClick={() => setOpen((o) => !o)}
        className={`w-full text-left ${hasLines ? "cursor-pointer hover:bg-muted/30" : "cursor-default"} transition-colors`}
      >
        <CardContent className="p-5 relative">
          <div className="flex items-start justify-between">
            <div className="space-y-1 min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <p className={`text-3xl font-bold tracking-tight ${textColor}`}>
                {loading ? <LoadingIndicator /> : value}
              </p>
              {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
            </div>
            {Icon && (
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ml-3 ${
                  bg ?? "bg-muted"
                }`}
              >
                <Icon className={`h-5 w-5 ${accent ?? "text-muted-foreground"}`} />
              </div>
            )}
          </div>
          {hasLines && (
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground absolute bottom-3 right-3 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          )}
        </CardContent>
      </button>

      {open && hasLines && (
        <div className="border-t border-border/50 px-5 py-4 space-y-1.5 bg-muted/20">
          {lines.map((line) => (
            <div key={line.account} className="flex justify-between text-sm">
              <span className="text-foreground">{line.account}</span>
              <span className="text-muted-foreground tabular-nums">
                {format(line.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
