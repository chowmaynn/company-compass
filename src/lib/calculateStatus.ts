import { type StatusColor } from "@/data/scorecardData";

/**
 * Parse a numeric value from various formats:
 * - Plain numbers: 136151
 * - Comma-separated: "3,675,000"
 * - Currency: "$3,675,000"
 * - Suffixed: "3.7k", "1.02m"
 * - Percentages: "49%", "4%"
 * Returns null for unparseable values like "—", "", "3 avg", "2 per week"
 */
export function parseNumeric(val: number | string): number | null {
  if (typeof val === "number") return val;
  if (val === "" || val === "—") return null;

  const s = String(val).trim();

  // Handle k/m suffixes: "3.7k", "1.02m"
  const kmMatch = s.match(/^([\d.]+)\s*([km])$/i);
  if (kmMatch) {
    const num = parseFloat(kmMatch[1]);
    const mult = kmMatch[2].toLowerCase() === "k" ? 1_000 : 1_000_000;
    return num * mult;
  }

  // Handle percentages: "49%", "4.5%"
  const pctMatch = s.match(/^([\d.]+)\s*%$/);
  if (pctMatch) return parseFloat(pctMatch[1]);

  // Handle currency/comma numbers: "$3,675,000", "3,500,000"
  const cleaned = s.replace(/[$,]/g, "");
  const num = parseFloat(cleaned);
  if (!isNaN(num) && /^[\d]+(\.\d+)?$/.test(cleaned)) return num;

  // Handle "X per week", "X / wk", "X/wk" patterns
  const perMatch = s.match(/^([\d.]+)\s*(?:\/\s*wk|per\s*week|\/\s*week)/i);
  if (perMatch) return parseFloat(perMatch[1]);

  return null;
}

/**
 * Metrics where lower actual = better performance.
 * For these, being under projection is good (Ahead) and over is bad (At Risk).
 */
export const invertedMetrics = new Set([
  "Customer support complaints",
]);

/**
 * Auto-calculate status based on the most recent week with actual data.
 * Compares actual vs projection for that week.
 *
 * Normal metrics (higher = better):
 * - Ahead (green): actual > projection
 * - On Track (light-green): actual >= 95% of projection
 * - Behind (yellow): actual >= 80% of projection
 * - At Risk (red): actual < 80% of projection
 *
 * Inverted metrics (lower = better, e.g. complaints):
 * - Ahead (green): actual < projection
 * - On Track (light-green): actual <= 105% of projection
 * - Behind (yellow): actual <= 120% of projection
 * - At Risk (red): actual > 120% of projection
 *
 * Returns null if status can't be calculated (missing or unparseable data).
 */
export function calculateStatus(
  weeks: { actual: number | string; projection: number | string }[],
  inverted = false
): StatusColor | null {
  // Find the most recent week with parseable actual data
  for (let i = weeks.length - 1; i >= 0; i--) {
    const actual = parseNumeric(weeks[i].actual);
    const projection = parseNumeric(weeks[i].projection);

    if (actual === null || projection === null || projection === 0) continue;

    if (inverted) {
      const ratio = actual / projection;
      if (ratio < 1) return "light-green";     // Ahead: under projected (good)
      if (ratio <= 1.05) return "green";        // On Track: at or within 5% over
      if (ratio < 1.2) return "yellow";        // Behind: 5–20% over
      return "red";                            // At Risk: 20%+ over
    }

    const ratio = actual / projection;
    if (ratio > 1) return "light-green";   // Ahead: over projected
    if (ratio >= 0.95) return "green";       // On Track: at or within 5% below
    if (ratio > 0.8) return "yellow";        // Behind: 5–20% below
    return "red";                            // At Risk: 20%+ below
  }

  return null;
}
