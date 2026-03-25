/**
 * Compact number formatting: 1200 → "1.2K", 1500000 → "1.5M"
 */
export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}

/**
 * Relative time: "2 hours ago", "3 days ago", "2 weeks ago"
 */
export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Formats a number or string value with comma separators.
 * If the value is already a string with formatting (like "1.02m", "3.5k", "4%"), it's returned as-is.
 * Pure numbers get comma formatting.
 */
export function formatValue(value: number | string): string {
  if (typeof value === "string") {
    // If it's a pure numeric string, format it
    const parsed = Number(value.replace(/,/g, ""));
    if (!isNaN(parsed) && /^[\d,]+(\.\d+)?$/.test(value.replace(/,/g, ""))) {
      return parsed.toLocaleString("en-US");
    }
    return value;
  }
  return value.toLocaleString("en-US");
}
