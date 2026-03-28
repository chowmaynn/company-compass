// bucketByWeek still used by bitly.ts, youtube-analytics.ts — not needed here anymore

// GA4 Property ID
const GA4_PROPERTY_ID = "411347290";

interface GADateValue {
  dimensionValues: { value: string }[];
  metricValues: { value: string }[];
}

interface GARunReportResponse {
  rows?: GADateValue[];
}

/**
 * Runs a GA4 report — tries service account proxy first, falls back to OAuth.
 */
async function runGA4Report(body: Record<string, unknown>): Promise<GARunReportResponse> {
  const res = await fetch(`/api/ga4/properties/${GA4_PROPERTY_ID}:runReport`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GA4 API error ${res.status}: ${err.error?.message || res.statusText}`);
  }
  return res.json();
}

/**
 * Fetches total sessions (visits) for the homepage in a given date range.
 * Sessions sum correctly across weeks (unlike activeUsers which deduplicates).
 */
export async function fetchPageSessions(startDate: string, endDate: string): Promise<number> {
  const data = await runGA4Report({
    dateRanges: [{ startDate, endDate }],
    dimensions: [],
    metrics: [{ name: "sessions" }],
    dimensionFilter: {
      andGroup: {
        expressions: [
          {
            filter: {
              fieldName: "hostName",
              stringFilter: { matchType: "EXACT", value: "www.aaaaccelerator.com" },
            },
          },
          {
            filter: {
              fieldName: "pageTitle",
              stringFilter: { matchType: "EXACT", value: "AAA Accelerator \u2014 Build a Profitable AI Automation Agency" },
            },
          },
        ],
      },
    },
  });
  return parseInt(data.rows?.[0]?.metricValues?.[0]?.value ?? "0", 10);
}

/**
 * Fetches sessions broken down by site variant (A/B/C) for the given date range.
 */
export async function fetchVariantVisitors(
  startDate: string,
  endDate: string
): Promise<{ variant: string; visitors: number }[]> {
  const data = await runGA4Report({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "customUser:site_variant" }],
    metrics: [{ name: "sessions" }],
    dimensionFilter: {
      filter: {
        fieldName: "hostName",
        stringFilter: { matchType: "EXACT", value: "www.aaaaccelerator.com" },
      },
    },
  });

  return (data.rows || []).map((row) => ({
    variant: row.dimensionValues[0].value,
    visitors: parseInt(row.metricValues[0].value, 10),
  }));
}

