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
