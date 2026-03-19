import { type StatusColor } from "@/data/scorecardData";
import { cn } from "@/lib/utils";

const statusConfig: Record<StatusColor, { label: string; className: string }> = {
  green: { label: "On Track", className: "bg-status-green/20 text-status-green border-status-green/30" },
  yellow: { label: "At Risk", className: "bg-status-yellow/20 text-status-yellow border-status-yellow/30" },
  red: { label: "Off Track", className: "bg-status-red/20 text-status-red border-status-red/30" },
  "light-red": { label: "Behind", className: "bg-status-light-red/20 text-status-light-red border-status-light-red/30" },
  "light-green": { label: "Ahead", className: "bg-status-light-green/20 text-status-light-green border-status-light-green/30" },
};

export function StatusBadge({ status }: { status: StatusColor }) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", config.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", {
        "bg-status-green": status === "green",
        "bg-status-yellow": status === "yellow",
        "bg-status-red": status === "red",
        "bg-status-light-red": status === "light-red",
        "bg-status-light-green": status === "light-green",
      })} />
      {config.label}
    </span>
  );
}
