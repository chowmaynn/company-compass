import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { scorecardData as initialData, departments, type Department, type Metric, type StatusColor } from "@/data/scorecardData";
import { DepartmentSection } from "@/components/DepartmentSection";
import { SummaryCards } from "@/components/SummaryCards";

const slugToDepartment: Record<string, Department> = {
  "evergreen-metrics": "Evergreen Metrics",
  "content": "Content",
  "marketing": "Marketing",
  "sales": "Sales",
  "community-management": "Community Management",
};

export default function DepartmentPage() {
  const { slug } = useParams<{ slug: string }>();
  const department = slug ? slugToDepartment[slug] : undefined;

  const [metrics, setMetrics] = useState<Metric[]>(initialData);

  if (!department) return <Navigate to="/" replace />;

  const deptMetrics = metrics.filter((m) => m.department === department);

  const handleMetricChange = (metricName: string, field: string, value: number | string) => {
    setMetrics((prev) =>
      prev.map((m) => {
        if (m.name !== metricName) return m;
        const updated = { ...m };
        if (field === "monthlyActual") updated.monthlyActual = value;
        else if (field === "monthlyTarget") updated.monthlyTarget = value;
        else if (field.startsWith("weeks.")) {
          const parts = field.split(".");
          const weekIndex = parseInt(parts[1]);
          const subField = parts[2] as "actual" | "projection";
          updated.weeks = updated.weeks.map((w, i) =>
            i === weekIndex ? { ...w, [subField]: value } : w
          );
        }
        return updated;
      })
    );
  };

  const handleStatusChange = (metricName: string, newStatus: StatusColor) => {
    setMetrics((prev) =>
      prev.map((m) => m.name === metricName ? { ...m, status: newStatus } : m)
    );
  };

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{department}</h1>
        <p className="text-sm text-muted-foreground mt-1">Department metrics & performance</p>
      </div>

      <SummaryCards metrics={deptMetrics} />

      <DepartmentSection
        department={department}
        metrics={deptMetrics}
        onMetricChange={handleMetricChange}
        onStatusChange={handleStatusChange}
        showCharts
      />
    </div>
  );
}
