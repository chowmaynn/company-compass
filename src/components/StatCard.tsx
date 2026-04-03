import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LoadingDots } from "@/components/LoadingDots";

export interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ElementType;
  /** Text colour applied to value and icon (e.g. "text-emerald-600") */
  accent?: string;
  /** Background colour for the icon circle (e.g. "bg-indigo-50 dark:bg-indigo-950/40") */
  bg?: string;
  /** Card-level gradient background (e.g. "bg-emerald-50/80") */
  gradient?: string;
  /** Optional trend badge */
  trend?: { value: string; up: boolean };
  /** Show pulsing placeholder instead of value */
  loading?: boolean;
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  bg,
  gradient,
  trend,
  loading,
}: StatCardProps) {
  const textColor = accent ?? "text-foreground";

  return (
    <Card className={`border-border/50 overflow-hidden ${gradient ?? ""}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <p
              className={`text-[11px] font-semibold uppercase tracking-wider ${
                gradient ? "text-emerald-700/70" : "text-muted-foreground"
              }`}
            >
              {label}
            </p>
            <p className={`text-3xl font-bold tracking-tight ${textColor}`}>
              {loading ? <LoadingDots /> : value}
            </p>
            {sub && (
              <p
                className={`text-xs ${
                  gradient ? "text-emerald-700/60" : "text-muted-foreground"
                }`}
              >
                {sub}
              </p>
            )}
          </div>
          {Icon && (
            <div
              className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ml-3 ${
                bg ?? (gradient ? "bg-emerald-600/20" : "bg-muted")
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  gradient ? "text-emerald-700" : (accent ?? "text-muted-foreground")
                }`}
              />
            </div>
          )}
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium mt-2 ${
              trend.up ? "text-emerald-500" : "text-red-500"
            }`}
          >
            {trend.up ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {trend.value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
