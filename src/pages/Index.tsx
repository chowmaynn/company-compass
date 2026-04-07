import { useState, useEffect, useMemo } from "react";
import { scorecardData as initialData, departments, scorecardMonth, type Department, type Metric } from "@/data/scorecardData";
import { calculateStatus, invertedMetrics } from "@/lib/calculateStatus";
import { SummaryCards } from "@/components/SummaryCards";
import { DepartmentSection } from "@/components/DepartmentSection";
import { useBitly } from "@/hooks/use-bitly";
import { useGoogleAnalytics } from "@/hooks/use-google-analytics";
import { useNotion } from "@/hooks/use-notion";
import { BarChart3 } from "lucide-react";

const Index = () => {
  const [activeDepartment, setActiveDepartment] = useState<Department | "all">("all");
  const [metrics, setMetrics] = useState<Metric[]>(initialData);

  const bitly = useBitly();
  const ga = useGoogleAnalytics();
  const notion = useNotion();

  // Update Content metrics with live Bitly data
  useEffect(() => {
    const metricMap: Record<string, keyof typeof bitly.weeklyClicks> = {
      "Clicks: YouTube > Skool": "yt-skool",
      "Clicks: YouTube > Accelerator": "yt-accelerator",
      "Clicks: Skool > Accelerator": "skool-accelerator",
    };

    setMetrics((prev) =>
      prev.map((m) => {
        const category = metricMap[m.name];
        if (!category) return m;

        const weekly = bitly.weeklyClicks[category];
        const numericCounts = weekly.filter((v): v is number => v !== "—");
        if (numericCounts.length === 0) return m;

        const totalMonth = numericCounts.reduce((a, b) => a + b, 0);
        return {
          ...m,
          weeks: m.weeks.map((w, i) => ({ ...w, actual: weekly[i] })),
          monthlyActual: totalMonth,
        };
      })
    );
  }, [bitly.weeklyClicks]);

  // Update Marketing metrics with live Google Analytics data
  useEffect(() => {
    const hasData = ga.weeklyViews.some((v) => v !== "—");
    if (!hasData) return;

    const formatCount = (n: number) =>
      n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}m`
        : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k`
          : String(n);

    setMetrics((prev) =>
      prev.map((m) => {
        if (m.name !== "Website Views") return m;

        const numericCounts = ga.weeklyViews.filter((v): v is number => v !== "—");
        const totalMonth = numericCounts.reduce((a, b) => a + b, 0);

        return {
          ...m,
          weeks: m.weeks.map((w, i) => {
            const val = ga.weeklyViews[i];
            return { ...w, actual: val === "—" ? "—" : formatCount(val) };
          }),
          monthlyActual: formatCount(totalMonth),
        };
      })
    );
  }, [ga.weeklyViews]);

  // Update Content metrics with live Notion data
  useEffect(() => {
    const hasPublished = notion.weeklyPublished.some((v) => v !== "—");
    const hasBacklog = notion.backlogCount !== "—";
    if (!hasPublished && !hasBacklog) return;

    setMetrics((prev) =>
      prev.map((m) => {
        if (m.department !== "Content") return m;

        if (m.name === "Videos posted last week" && hasPublished) {
          const numericCounts = notion.weeklyPublished.filter((v): v is number => v !== "—");
          const totalMonth = numericCounts.reduce((a, b) => a + b, 0);
          return {
            ...m,
            weeks: m.weeks.map((w, i) => ({
              ...w,
              actual: notion.weeklyPublished[i],
            })),
            monthlyActual: totalMonth,
          };
        }

        if (m.name === "Videos in the backlog" && hasBacklog) {
          // Backlog is a snapshot count — show same value across all weeks
          return {
            ...m,
            weeks: m.weeks.map((w) => ({
              ...w,
              actual: notion.backlogCount,
            })),
            monthlyActual: `${notion.backlogCount} avg`,
          };
        }

        return m;
      })
    );
  }, [notion.weeklyPublished, notion.backlogCount]);


  const filteredMetrics = activeDepartment === "all"
    ? metrics
    : metrics.filter((m) => m.department === activeDepartment);

  const visibleDepartments = activeDepartment === "all"
    ? departments
    : [activeDepartment];

  const showCharts = activeDepartment !== "all";

  const autoMetrics = new Set([
    "Videos posted last week", "Videos in the backlog",
    "Clicks: YouTube > Skool", "Clicks: YouTube > Accelerator", "Clicks: Skool > Accelerator",
    "Website Views",
  ]);

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

  // Auto-calculate statuses based on most recent week's actual vs projection
  const weekDataKey = useMemo(
    () => metrics.map((m) => m.weeks.map((w) => `${w.actual}|${w.projection}`).join(",")).join(";"),
    [metrics]
  );

  useEffect(() => {
    setMetrics((prev) => {
      let changed = false;
      const updated = prev.map((m) => {
        const newStatus = calculateStatus(m.weeks, invertedMetrics.has(m.name));
        if (newStatus && newStatus !== m.status) {
          changed = true;
          return { ...m, status: newStatus };
        }
        return m;
      });
      return changed ? updated : prev;
    });
  }, [weekDataKey]);

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
              showCharts={showCharts}
              readOnlyMetrics={dept === "Content" || dept === "Marketing" ? autoMetrics : undefined}
              needsAuth={false}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Index;
