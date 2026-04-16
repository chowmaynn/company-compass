import { cn } from "@/lib/utils";

/**
 * Subtle horizontal divider line used to separate major sections.
 * Renders a 2px-thick ultra-faint white rule with 24px of breathing room below it.
 */
export function DividerLine({ className }: { className?: string }) {
  return <div className={cn("border-t-2 border-white/5 pt-6", className)} />;
}
