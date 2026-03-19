import { type Department, type Metric } from "@/data/scorecardData";
import { MetricTable } from "./MetricTable";
import { BarChart3, Video, Megaphone, Phone, Users } from "lucide-react";

const departmentIcons: Record<Department, React.ElementType> = {
  "Evergreen Metrics": BarChart3,
  Content: Video,
  Marketing: Megaphone,
  Sales: Phone,
  "Community Management": Users,
};

const departmentColors: Record<Department, string> = {
  "Evergreen Metrics": "from-primary/20 to-transparent border-primary/30",
  Content: "from-status-green/20 to-transparent border-status-green/30",
  Marketing: "from-status-yellow/20 to-transparent border-status-yellow/30",
  Sales: "from-status-red/20 to-transparent border-status-red/30",
  "Community Management": "from-primary/20 to-transparent border-primary/30",
};

interface DepartmentSectionProps {
  department: Department;
  metrics: Metric[];
  onMetricChange?: (metricName: string, field: string, value: number | string) => void;
}

export function DepartmentSection({ department, metrics, onMetricChange }: DepartmentSectionProps) {
  const Icon = departmentIcons[department];
  const colorClass = departmentColors[department];

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
          {statusSummary.green || statusSummary["light-green"] ? (
            <span className="flex items-center gap-1 rounded-full bg-status-green/20 px-2 py-0.5 text-xs font-medium text-status-green">
              {(statusSummary.green || 0) + (statusSummary["light-green"] || 0)} on track
            </span>
          ) : null}
          {statusSummary.yellow ? (
            <span className="flex items-center gap-1 rounded-full bg-status-yellow/20 px-2 py-0.5 text-xs font-medium text-status-yellow">
              {statusSummary.yellow} at risk
            </span>
          ) : null}
          {(statusSummary.red || statusSummary["light-red"]) ? (
            <span className="flex items-center gap-1 rounded-full bg-status-red/20 px-2 py-0.5 text-xs font-medium text-status-red">
              {(statusSummary.red || 0) + (statusSummary["light-red"] || 0)} off track
            </span>
          ) : null}
        </div>
      </div>
      <MetricTable metrics={metrics} onMetricChange={onMetricChange} />
    </div>
  );
}
