import { AlertCircle } from "lucide-react";

export interface DashboardShellProps {
  loading: boolean;
  error?: string | null;
  loadingMessage?: string;
  children: React.ReactNode;
}

/**
 * Shared wrapper for dashboard pages. Always renders children (skeleton-first).
 * Applies a subtle shimmer overlay when loading. Only blocks on error.
 */
export function DashboardShell({
  loading,
  error,
  children,
}: DashboardShellProps) {
  if (error) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-red-600">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className={`relative ${loading ? "dashboard-loading" : ""}`}>
      {children}
    </div>
  );
}
