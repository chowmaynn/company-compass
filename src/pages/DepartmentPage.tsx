import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { scorecardData as initialData, type Department, type Metric } from "@/data/scorecardData";

import { DepartmentSection } from "@/components/DepartmentSection";
import { ProductDashboard } from "@/components/ProductDashboard";
import { SalesDashboard } from "@/components/SalesDashboard";
import { RepMetrics } from "@/components/RepMetrics";
import { CircleCharts } from "@/components/CircleCharts";
import { DepartmentCharts } from "@/components/DepartmentCharts";
import CoachesDashboard from "@/pages/CoachesDashboard";
import SuccessTrackingDashboard from "@/pages/SuccessTrackingDashboard";
import SupportDashboard from "@/pages/SupportDashboard";
import FinanceDashboard from "@/pages/FinanceDashboard";
import { LayoutDashboard, BarChart3, Users, Shield, Trophy, HeadphonesIcon, DollarSign } from "lucide-react";

const slugToDepartment: Record<string, Department> = {
  "finance": "Finance",
  "evergreen-metrics": "Product",
  "content": "Content",
  "marketing": "Marketing",
  "sales": "Sales",
  "community-management": "Product",
};

type Tab = "dashboard" | "charts" | "rep-metrics" | "coaches" | "success" | "support" | "finance";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "charts",    label: "Charts",   icon: BarChart3 },
];

const productTabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Overview",        icon: LayoutDashboard },
  { id: "coaches",   label: "Coaches",         icon: Shield },
  { id: "success",   label: "Success Tracker", icon: Trophy },
  { id: "support",   label: "Support",         icon: HeadphonesIcon },
];

const salesTabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard",   label: "Dashboard",   icon: LayoutDashboard },
  { id: "rep-metrics", label: "Rep Metrics", icon: Users },
];

const financeTabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "finance", label: "Overview", icon: DollarSign },
];

export default function DepartmentPage() {
  const { slug } = useParams<{ slug: string }>();
  const department = slug ? slugToDepartment[slug] : undefined;

  const [activeTab, setActiveTab] = useState<Tab>(slug === "finance" ? "finance" : "dashboard");
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

  const isProduct = department === "Product";
  const isSales = department === "Sales";
  const isFinance = department === "Finance";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Header ────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {isFinance ? "Subscriptions Overview" : department}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Department metrics & performance</p>
      </div>

      {/* ── Tab Toggle ────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {(isFinance ? financeTabs : isSales ? salesTabs : isProduct ? productTabs : tabs).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ───────────────────────────────────── */}
      {activeTab === "finance" && <FinanceDashboard />}

      {activeTab === "dashboard" && (
        isProduct ? (
          <ProductDashboard />
        ) : isSales ? (
          <SalesDashboard />
        ) : (
          <DepartmentSection
            department={department}
            metrics={deptMetrics}
            onMetricChange={handleMetricChange}
          />
        )
      )}

      {activeTab === "charts" && (
        isProduct ? (
          <CircleCharts />
        ) : (
          <DepartmentCharts metrics={deptMetrics} />
        )
      )}

      {activeTab === "rep-metrics" && <RepMetrics />}

      {activeTab === "coaches" && <CoachesDashboard />}

      {activeTab === "success" && <SuccessTrackingDashboard />}

      {activeTab === "support" && <SupportDashboard />}

    </div>
  );
}
