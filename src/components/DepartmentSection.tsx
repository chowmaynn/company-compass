import { type Department, type Metric } from "@/data/scorecardData";
import { MetricTable } from "./MetricTable";
import { DailyTrackingTable } from "./DailyTrackingTable";
import { DepartmentCharts } from "./DepartmentCharts";
import { getAuthUrl } from "@/lib/youtube-auth";
import { useCurrency } from "@/components/AppLayout";
import { useAuth } from "@/hooks/use-auth";
import { BarChart3, Video, Megaphone, Phone, Users, LogIn } from "lucide-react";

const departmentIcons: Record<Department, React.ElementType> = {
  "Finance": BarChart3,
  Content: Video,
  Marketing: Megaphone,
  Sales: Phone,
  "Product": Users,
};

const departmentColors: Record<Department, string> = {
  "Finance": "from-primary/20 to-transparent border-primary/30",
  Content: "from-primary/20 to-transparent border-primary/30",
  Marketing: "from-primary/20 to-transparent border-primary/30",
  Sales: "from-primary/20 to-transparent border-primary/30",
  "Product": "from-primary/20 to-transparent border-primary/30",
};

interface DepartmentSectionProps {
  department: Department;
  metrics: Metric[];
  onMetricChange?: (metricName: string, field: string, value: number | string) => void;
  showCharts?: boolean;
  readOnlyMetrics?: Set<string>;
  needsAuth?: boolean;
  month?: string;
}

export function DepartmentSection({ department, metrics, onMetricChange, showCharts, readOnlyMetrics, needsAuth, month }: DepartmentSectionProps) {
  const Icon = departmentIcons[department];
  const colorClass = departmentColors[department];
  const { currency, rate } = useCurrency();
  const { canEdit } = useAuth();
  const isFinance = department === "Finance";

  const statusSummary = metrics.reduce(
    (acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-3 rounded-lg border bg-gradient-to-r p-4 ${colorClass}`}>
        <Icon className="h-5 w-5 text-foreground" />
        <h2 className="text-lg font-bold tracking-tight text-foreground">{department}</h2>
        <div className="ml-auto flex items-center gap-2">
          {needsAuth && (
            <a
              href={getAuthUrl()}
              className="flex items-center gap-1.5 rounded-full bg-background/50 px-3 py-1 text-xs font-medium text-foreground/80 transition-colors hover:bg-background/80"
            >
              <LogIn className="h-3 w-3" />
              Connect Google
            </a>
          )}
          {statusSummary["light-green"] ? (
            <span className="flex items-center gap-1 rounded-full bg-status-light-green/20 px-2 py-0.5 text-xs font-medium text-status-light-green">
              {statusSummary["light-green"]} ahead
            </span>
          ) : null}
          {statusSummary.green ? (
            <span className="flex items-center gap-1 rounded-full bg-status-green/20 px-2 py-0.5 text-xs font-medium text-status-green">
              {statusSummary.green} on track
            </span>
          ) : null}
          {statusSummary.yellow ? (
            <span className="flex items-center gap-1 rounded-full bg-status-yellow/20 px-2 py-0.5 text-xs font-medium text-status-yellow">
              {statusSummary.yellow} behind
            </span>
          ) : null}
          {statusSummary.red ? (
            <span className="flex items-center gap-1 rounded-full bg-status-red/20 px-2 py-0.5 text-xs font-medium text-status-red">
              {statusSummary.red} at risk
            </span>
          ) : null}
        </div>
      </div>
      {showCharts && <DepartmentCharts metrics={metrics} />}
      {department === "Marketing" && showCharts && <DailyTrackingTable />}
      {department === "Marketing" && showCharts && (
        <p className="text-sm font-medium text-muted-foreground">Weekly Tracking</p>
      )}
      <MetricTable
        metrics={metrics}
        onMetricChange={onMetricChange}
        readOnlyMetrics={readOnlyMetrics}
        currencyRate={isFinance && currency === "USD" && rate ? rate : undefined}
        usDateFormat={currency === "USD"}
        canEditMetric={() => true}
        month={month}
      />
    </div>
  );
}
