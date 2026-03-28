import { Loader2, AlertCircle } from "lucide-react";

export interface DashboardShellProps {
  loading: boolean;
  error?: string | null;
  loadingMessage?: string;
  children: React.ReactNode;
}

/**
 * Shared wrapper for dashboard pages that shows a loading spinner
 * or error message before rendering children.
 */
export function DashboardShell({
  loading,
  error,
  loadingMessage = "Loading data\u2026",
  children,
}: DashboardShellProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-sm">{loadingMessage}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-red-600">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  return <>{children}</>;
}
