import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { scorecardData as initialData, type Department, type Metric } from "@/data/scorecardData";

import { DepartmentSection } from "@/components/DepartmentSection";
import { ProductDashboard } from "@/components/ProductDashboard";
import { CircleCharts } from "@/components/CircleCharts";
import { DepartmentCharts } from "@/components/DepartmentCharts";
import CoachesDashboard from "@/pages/CoachesDashboard";
import SuccessTrackingDashboard from "@/pages/SuccessTrackingDashboard";
import SupportDashboard from "@/pages/SupportDashboard";
import SubscriptionDashboard from "@/pages/SubscriptionDashboard";
import MarketingDashboard from "@/pages/MarketingDashboard";
import { CompetitorsDashboard } from "@/components/CompetitorsDashboard";
import { ContentOverview } from "@/components/ContentOverview";
import { SalesTrackingPage } from "@/components/SalesTrackingPage";
import { LayoutDashboard, BarChart3, Shield, Trophy, HeadphonesIcon, DollarSign, Swords, Megaphone } from "lucide-react";

const slugToDepartment: Record<string, Department> = {
  "finance": "Finance",
  "evergreen-metrics": "Product",
  "content": "Content",
  "marketing": "Marketing",
  "sales": "Sales",
  "community-management": "Product",
  "product": "Product",
};

type Tab = "dashboard" | "charts" | "coaches" | "success" | "support" | "finance" | "competitors" | "marketing" | "tracking";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "charts",    label: "Charts",   icon: BarChart3 },
];

const productTabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Overview",        icon: LayoutDashboard },
  { id: "support",   label: "Support",         icon: HeadphonesIcon },
  { id: "coaches",   label: "Coaches",         icon: Shield },
  { id: "success",   label: "Success Tracker", icon: Trophy },
];

const financeTabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "finance", label: "Overview", icon: DollarSign },
];

const contentTabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard",   label: "Our Channel",  icon: LayoutDashboard },
  { id: "competitors", label: "Competitors",  icon: Swords },
];

const marketingTabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "marketing", label: "Overview", icon: Megaphone },
];

export default function DepartmentPage() {
  const { slug } = useParams<{ slug: string }>();
  // Force full remount when navigating between departments
  return <DepartmentPageInner key={slug} />;
}

function DepartmentPageInner() {
  const { slug } = useParams<{ slug: string }>();
  const department = slug ? slugToDepartment[slug] : undefined;

  const [activeTab, setActiveTab] = useState<Tab>(
    slug === "finance" ? "finance" : slug === "marketing" ? "marketing" : slug === "sales" ? "tracking" : "dashboard"
  );
  const [metrics, setMetrics] = useState<Metric[]>(initialData);

  // Reset tab when navigating between departments
  useEffect(() => {
    setActiveTab(slug === "finance" ? "finance" : slug === "marketing" ? "marketing" : slug === "sales" ? "tracking" : "dashboard");
  }, [slug]);

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
  const isContent = department === "Content";
  const isMarketing = department === "Marketing";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Tab Toggle ────────────────────────────────────── */}
      {!isMarketing && !isFinance && !isSales && <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {(isProduct ? productTabs : isContent ? contentTabs : tabs).map((tab) => {
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
      </div>}

      {/* ── Tab Content ───────────────────────────────────── */}
      {activeTab === "finance" && <SubscriptionDashboard />}

      {activeTab === "dashboard" && (
        isProduct ? (
          <ProductDashboard />
        ) : isContent ? (
          <ContentOverview />
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

      {activeTab === "coaches" && <CoachesDashboard />}

      {activeTab === "success" && <SuccessTrackingDashboard />}

      {activeTab === "support" && <SupportDashboard />}

      {activeTab === "competitors" && <CompetitorsDashboard />}

      {activeTab === "marketing" && <MarketingDashboard />}

      {activeTab === "tracking" && <SalesTrackingPage />}

    </div>
  );
}
