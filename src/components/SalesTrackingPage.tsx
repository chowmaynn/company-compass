import { useState } from "react";
import { useSalesTracking } from "@/hooks/use-sales-tracking";
import { SalesLeaderboard } from "@/components/SalesLeaderboard";
import { SalesTrackingTable } from "@/components/SalesTrackingTable";

export function SalesTrackingPage() {
  const defaultMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);

  const tracking = useSalesTracking(month);

  return (
    <div className="space-y-6">
      <SalesLeaderboard reps={tracking.reps} loading={tracking.isLoading} />
      <SalesTrackingTable
        month={month}
        setMonth={setMonth}
        {...tracking}
      />
    </div>
  );
}
