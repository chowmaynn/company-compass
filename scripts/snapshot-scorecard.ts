/**
 * Standalone script to snapshot weekly scorecard API metrics into Supabase.
 * Run: npx tsx scripts/snapshot-scorecard.ts
 *
 * This script loads .env and calls the snapshot function.
 * It must be run while the Vite dev server is running (for API proxies).
 */

import { config } from "dotenv";
config(); // Load .env

// The snapshot function imports from src/lib which uses import.meta.env.
// For standalone execution, we set globalThis so Vite env vars resolve.
const envProxy = new Proxy({} as Record<string, string>, {
  get(_, key: string) {
    return process.env[key] ?? "";
  },
});

// @ts-ignore — polyfill import.meta.env for Node context
if (typeof import.meta !== "undefined") {
  (import.meta as any).env = envProxy;
}

async function main() {
  console.log("[Snapshot Script] Starting weekly scorecard snapshot...");

  // Dynamic import to ensure env is set first
  const { snapshotWeeklyApiMetrics } = await import("../src/lib/scorecard-snapshot");

  const results = await snapshotWeeklyApiMetrics();

  if (results.length === 0) {
    console.log("[Snapshot Script] No metrics to snapshot (no completed week or all weeks past).");
  } else {
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`[Snapshot Script] Done: ${succeeded} succeeded, ${failed} failed out of ${results.length} total.`);
  }
}

main().catch((err) => {
  console.error("[Snapshot Script] Fatal error:", err);
  process.exit(1);
});
