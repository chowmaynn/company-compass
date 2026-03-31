import { useState } from "react";
import { useSalesTracking } from "@/hooks/use-sales-tracking";
import { SalesLeaderboard } from "@/components/SalesLeaderboard";
import { SalesTrackingTable } from "@/components/SalesTrackingTable";
import { Card } from "@/components/ui/card";
import { fmtCurrency } from "@/lib/formatNumber";

export function SalesTrackingPage() {
  const defaultMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);

  const tracking = useSalesTracking(month);
  const team = tracking.teamTotals?.monthly;

  const closes = team?.closes ?? 0;
  const callsTaken = team?.calls_taken ?? 0;
  const callsBooked = team?.calls_booked ?? 0;
  const cc = team?.cc ?? 0;
  const closeRate = team?.close_rate ?? 0;
  const showRate = team?.show_rate ?? 0;

  return (
    <div className="space-y-6">
      {/* KPI Bar */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-white/[0.06]">
          <KPIStat
            label="CLOSES"
            value={closes}
            sub="Deals closed"
            accent="text-status-green"
            loading={tracking.isLoading}
          />
          <KPIStat
            label="CLOSE RATE"
            value={`${closeRate.toFixed(0)}%`}
            sub="Closes ÷ Calls Taken"
            loading={tracking.isLoading}
          />
          <KPIStat
            label="CALLS TAKEN"
            value={callsTaken}
            sub={`of ${callsBooked} booked`}
            loading={tracking.isLoading}
          />
          <KPIStat
            label="SHOW RATE"
            value={`${showRate.toFixed(0)}%`}
            sub="Taken ÷ Booked"
            loading={tracking.isLoading}
          />
          <KPIStat
            label="CALLS BOOKED"
            value={callsBooked}
            sub="Total booked"
            loading={tracking.isLoading}
          />
          <KPIStat
            label="CONTRACT VALUE"
            value={fmtCurrency(cc)}
            sub="Total CC"
            accent="text-primary"
            loading={tracking.isLoading}
          />
        </div>
      </Card>

      <SalesLeaderboard reps={tracking.reps} loading={tracking.isLoading} />
      <SalesTrackingTable
        month={month}
        setMonth={setMonth}
        {...tracking}
      />
    </div>
  );
}

function KPIStat({
  label, value, sub, accent, loading,
}: {
  label: string;
  value: number | string;
  sub: string;
  accent?: string;
  loading?: boolean;
}) {
  return (
    <div className="p-5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-3xl font-bold ${accent ?? "text-foreground"}`}>
        {loading ? "—" : value}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
