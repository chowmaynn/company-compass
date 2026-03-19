import { useState } from "react";
import { scorecardData as initialData, departments, scorecardMonth, type Department, type Metric, type StatusColor } from "@/data/scorecardData";
import { SummaryCards } from "@/components/SummaryCards";
import { DepartmentSection } from "@/components/DepartmentSection";
import { BarChart3 } from "lucide-react";

const Index = () => {
  const [activeDepartment, setActiveDepartment] = useState<Department | "all">("all");
  const [metrics, setMetrics] = useState<Metric[]>(initialData);

  const filteredMetrics = activeDepartment === "all"
    ? metrics
    : metrics.filter((m) => m.department === activeDepartment);

  const visibleDepartments = activeDepartment === "all"
    ? departments
    : [activeDepartment];

  const showCharts = activeDepartment !== "all";

  const handleMetricChange = (metricName: string, field: string, value: number | string) => {
    setMetrics((prev) =>
      prev.map((m) => {
        if (m.name !== metricName) return m;
        const updated = { ...m };
        if (field === "monthlyActual") {
          updated.monthlyActual = value;
        } else if (field === "monthlyTarget") {
          updated.monthlyTarget = value;
        } else if (field.startsWith("weeks.")) {
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Company Scorecard</h1>
              <p className="text-xs text-muted-foreground">{scorecardMonth}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">
        <SummaryCards metrics={filteredMetrics} />

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveDepartment("all")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeDepartment === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            All Departments
          </button>
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setActiveDepartment(dept)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeDepartment === dept
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        <div className="space-y-8">
          {visibleDepartments.map((dept) => (
            <DepartmentSection
              key={dept}
              department={dept}
              metrics={metrics.filter((m) => m.department === dept)}
              onMetricChange={handleMetricChange}
              onStatusChange={handleStatusChange}
              showCharts={showCharts}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Index;
