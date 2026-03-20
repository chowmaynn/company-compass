import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { scorecardData, departments, type Department } from "@/data/scorecardData";
import {
  DollarSign,
  TrendingUp,
  Users,
  Video,
  Eye,
  UserPlus,
  Phone,
  Mail,
  GripVertical,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface Widget {
  id: string;
  title: string;
  icon: React.ElementType;
  value: string | number;
  subtitle: string;
  trend?: "up" | "down";
  trendValue?: string;
  category: "revenue" | "content" | "marketing" | "sales" | "community";
}

const generateWidgets = (): Widget[] => {
  const metrics = scorecardData;
  const revenue = metrics.find((m) => m.name === "Revenue");
  const cash = metrics.find((m) => m.name === "Cash Collected");
  const ytViews = metrics.find((m) => m.name === "YouTube views");
  const ytSubs = metrics.find((m) => m.name === "New YouTube subscribers");
  const bookings = metrics.find((m) => m.name === "Total Bookings");
  const emailBookings = metrics.find((m) => m.name === "Email Bookings");
  const triageCalls = metrics.find((m) => m.name === "Triage Calls Booked");
  const complaints = metrics.find((m) => m.name === "Customer support complaints");

  return [
    {
      id: "revenue",
      title: "Revenue",
      icon: DollarSign,
      value: typeof revenue?.monthlyActual === "number" ? `$${revenue.monthlyActual.toLocaleString()}` : String(revenue?.monthlyActual || "—"),
      subtitle: `Target: ${revenue?.monthlyTarget}`,
      trend: "down",
      trendValue: "18.4%",
      category: "revenue",
    },
    {
      id: "cash",
      title: "Cash Collected",
      icon: TrendingUp,
      value: typeof cash?.monthlyActual === "number" ? `$${cash.monthlyActual.toLocaleString()}` : String(cash?.monthlyActual || "—"),
      subtitle: `Target: ${cash?.monthlyTarget}`,
      trend: "down",
      trendValue: "18.4%",
      category: "revenue",
    },
    {
      id: "yt-views",
      title: "YouTube Views",
      icon: Eye,
      value: String(ytViews?.monthlyActual || "—"),
      subtitle: `Target: ${ytViews?.monthlyTarget}`,
      trend: "up",
      trendValue: "2.0%",
      category: "content",
    },
    {
      id: "yt-subs",
      title: "New Subscribers",
      icon: UserPlus,
      value: String(ytSubs?.monthlyActual || "—"),
      subtitle: `Target: ${ytSubs?.monthlyTarget}`,
      trend: "down",
      trendValue: "18.5%",
      category: "content",
    },
    {
      id: "bookings",
      title: "Total Bookings",
      icon: Phone,
      value: String(bookings?.monthlyActual || "—"),
      subtitle: `Target: ${bookings?.monthlyTarget}`,
      trend: "down",
      trendValue: "52.5%",
      category: "marketing",
    },
    {
      id: "email-bookings",
      title: "Email Bookings",
      icon: Mail,
      value: String(emailBookings?.monthlyActual || "—"),
      subtitle: `Target: ${emailBookings?.monthlyTarget}`,
      category: "marketing",
    },
    {
      id: "triage",
      title: "Triage Calls Booked",
      icon: Phone,
      value: String(triageCalls?.monthlyActual || "—"),
      subtitle: `Target: ${triageCalls?.monthlyTarget}`,
      category: "sales",
    },
    {
      id: "complaints",
      title: "Support Complaints",
      icon: Users,
      value: String(complaints?.monthlyActual || "—"),
      subtitle: `Target: ${complaints?.monthlyTarget}`,
      trend: "up",
      trendValue: "93.3%",
      category: "community",
    },
  ];
};

const categoryColors: Record<string, string> = {
  revenue: "border-l-primary",
  content: "border-l-status-green",
  marketing: "border-l-status-yellow",
  sales: "border-l-status-red",
  community: "border-l-primary",
};

export default function Dashboard() {
  const widgets = generateWidgets();

  const statusSummary = scorecardData.reduce(
    (acc, m) => {
      if (m.status === "green" || m.status === "light-green") acc.onTrack++;
      else if (m.status === "yellow") acc.atRisk++;
      else acc.offTrack++;
      return acc;
    },
    { onTrack: 0, atRisk: 0, offTrack: 0 }
  );

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Company-wide metrics overview — January 2025
        </p>
      </div>

      {/* Health overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-status-green">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground">On Track</p>
            <p className="text-3xl font-bold text-status-green mt-1">{statusSummary.onTrack}</p>
            <p className="text-xs text-muted-foreground mt-1">metrics performing well</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-status-yellow">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground">At Risk</p>
            <p className="text-3xl font-bold text-status-yellow mt-1">{statusSummary.atRisk}</p>
            <p className="text-xs text-muted-foreground mt-1">metrics need attention</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-status-red">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-muted-foreground">Off Track</p>
            <p className="text-3xl font-bold text-status-red mt-1">{statusSummary.offTrack}</p>
            <p className="text-xs text-muted-foreground mt-1">metrics behind target</p>
          </CardContent>
        </Card>
      </div>

      {/* Widget grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Key Metrics</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <GripVertical className="h-3 w-3" /> Customizable widgets coming soon
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {widgets.map((widget) => (
            <Card
              key={widget.id}
              className={`border-l-4 ${categoryColors[widget.category]} transition-all hover:border-primary/30 hover:glow-primary`}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">{widget.title}</p>
                  <div className="rounded-lg bg-muted p-2">
                    <widget.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-2xl font-bold tracking-tight text-foreground">{widget.value}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">{widget.subtitle}</p>
                  {widget.trend && (
                    <span className={`flex items-center gap-0.5 text-xs font-medium ${widget.trend === "up" ? "text-status-green" : "text-status-red"}`}>
                      {widget.trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {widget.trendValue}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Department summary */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Departments</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => {
            const deptMetrics = scorecardData.filter((m) => m.department === dept);
            const green = deptMetrics.filter((m) => m.status === "green" || m.status === "light-green").length;
            const yellow = deptMetrics.filter((m) => m.status === "yellow").length;
            const red = deptMetrics.filter((m) => m.status === "red" || m.status === "light-red").length;

            return (
              <Card key={dept} className="hover:border-primary/30 transition-all">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-foreground">{dept}</h3>
                    <span className="text-xs text-muted-foreground">{deptMetrics.length} metrics</span>
                  </div>
                  <div className="flex gap-3">
                    {green > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-status-green">
                        <span className="h-2 w-2 rounded-full bg-status-green" />
                        {green}
                      </span>
                    )}
                    {yellow > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-status-yellow">
                        <span className="h-2 w-2 rounded-full bg-status-yellow" />
                        {yellow}
                      </span>
                    )}
                    {red > 0 && (
                      <span className="flex items-center gap-1 text-xs font-medium text-status-red">
                        <span className="h-2 w-2 rounded-full bg-status-red" />
                        {red}
                      </span>
                    )}
                  </div>
                  {/* Simple progress bar */}
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted mt-3">
                    {green > 0 && <div className="bg-status-green" style={{ width: `${(green / deptMetrics.length) * 100}%` }} />}
                    {yellow > 0 && <div className="bg-status-yellow" style={{ width: `${(yellow / deptMetrics.length) * 100}%` }} />}
                    {red > 0 && <div className="bg-status-red" style={{ width: `${(red / deptMetrics.length) * 100}%` }} />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
