import { useState, useEffect } from "react";
import { departments, type StatusColor } from "@/data/scorecardData";
import { DepartmentSection } from "@/components/DepartmentSection";
import { useScorecard } from "@/hooks/use-scorecard";
import { fetchAvailableMonths } from "@/lib/supabase-scorecard";
import { Loader2, ChevronDown } from "lucide-react";

function formatMonth(m: string): string {
  const [year, month] = m.split("-");
  const names = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[parseInt(month)]} ${year}`;
}

export default function Scorecard() {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState("2026-03");
  const { metrics, loading, error, updateMetric } = useScorecard(selectedMonth);

  useEffect(() => {
    fetchAvailableMonths().then((months) => {
      if (months.length > 0) {
        setAvailableMonths(months);
        setSelectedMonth(months[0]); // most recent
      }
    });
  }, []);

  const handleStatusChange = (metricName: string, newStatus: StatusColor) => {
    updateMetric(metricName, "status", newStatus);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading scorecard…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-status-red">
        Failed to load scorecard: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1440px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-transparent text-sm text-muted-foreground font-medium pr-6 cursor-pointer hover:text-foreground transition-colors focus:outline-none"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Status cards in navbar */}

      <div className="space-y-8">
        {departments.map((dept) => (
          <DepartmentSection
            key={dept}
            department={dept}
            metrics={metrics.filter((m) => m.department === dept)}
            onMetricChange={updateMetric}
            onStatusChange={handleStatusChange}
            showCharts={false}
          />
        ))}
      </div>
    </div>
  );
}
