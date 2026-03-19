import { type StatusColor, statusOptions } from "@/data/scorecardData";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const statusConfig: Record<StatusColor, { label: string; className: string; dotClass: string }> = {
  green: { label: "On Track", className: "bg-status-green/20 text-status-green border-status-green/30", dotClass: "bg-status-green" },
  yellow: { label: "At Risk", className: "bg-status-yellow/20 text-status-yellow border-status-yellow/30", dotClass: "bg-status-yellow" },
  red: { label: "Off Track", className: "bg-status-red/20 text-status-red border-status-red/30", dotClass: "bg-status-red" },
  "light-red": { label: "Behind", className: "bg-status-light-red/20 text-status-light-red border-status-light-red/30", dotClass: "bg-status-light-red" },
  "light-green": { label: "Ahead", className: "bg-status-light-green/20 text-status-light-green border-status-light-green/30", dotClass: "bg-status-light-green" },
};

interface StatusBadgeProps {
  status: StatusColor;
  editable?: boolean;
  onChange?: (status: StatusColor) => void;
}

export function StatusBadge({ status, editable, onChange }: StatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const config = statusConfig[status];

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  if (!editable) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", config.className)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
        {config.label}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-all hover:brightness-110",
          config.className
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
        {config.label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 min-w-[140px] rounded-lg border border-border bg-popover p-1 shadow-xl">
          {statusOptions.map((opt) => {
            const optConfig = statusConfig[opt.value];
            return (
              <button
                key={opt.value}
                onClick={() => {
                  onChange?.(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
                  opt.value === status && "bg-muted"
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", optConfig.dotClass)} />
                <span className="text-foreground">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
