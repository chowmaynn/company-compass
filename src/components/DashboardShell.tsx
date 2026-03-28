import { Loader2, AlertCircle } from "lucide-react";

export interface DashboardShellProps {
  loading: boolean;
  error?: string | null;
  loadingMessage?: string;
  children: React.ReactNode;
}

/**
 * Shared wrapper for dashboard pages. Always renders children (skeleton-first).
 * Shows a subtle loading indicator inline, not blocking the UI.
 * Only blocks on error.
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
    <div className="relative">
      {loading && (
        <div className="absolute top-0 right-0 z-10 flex items-center gap-1.5 text-muted-foreground bg-card/80 backdrop-blur-sm rounded-md px-2 py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Loading...</span>
        </div>
      )}
      {children}
    </div>
  );
}
