import { getValidAccessToken } from "./youtube-auth";

// GA4 Property ID — replace with your actual property ID from GA Admin > Property Settings
const GA4_PROPERTY_ID = "411347290";

interface GADateValue {
  dimensionValues: { value: string }[];
  metricValues: { value: string }[];
}

interface GARunReportResponse {
  rows?: GADateValue[];
}

/**
 * Fetches daily session/screenPageView counts from GA4 Data API
 * for the given date range.
 */
export async function fetchWeeklyPageViews(
  startDate: string, // YYYY-MM-DD
  endDate: string     // YYYY-MM-DD
): Promise<{ date: string; views: number }[]> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) throw new Error("Not authenticated — connect Google account");

  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }],
        dimensionFilter: {
          filter: {
            fieldName: "hostName",
            stringFilter: {
              matchType: "EXACT",
              value: "www.aaaaccelerator.com",
            },
          },
        },
        orderBys: [{ dimension: { dimensionName: "date" } }],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `GA4 API error ${res.status}: ${err.error?.message || res.statusText}`
    );
  }

  const data: GARunReportResponse = await res.json();

  return (data.rows || []).map((row) => ({
    // GA4 returns dates as "20260315" format
    date: row.dimensionValues[0].value.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
    views: parseInt(row.metricValues[0].value, 10),
  }));
}

/**
 * Buckets daily page view data into weekly totals based on week boundaries.
 * Returns "—" for future weeks.
 */
export function bucketViewsByWeek(
  rows: { date: string; views: number }[],
  weekConfigs: { start: string; end: string }[]
): (number | "—")[] {
  const now = new Date();

  return weekConfigs.map((wc) => {
    const start = new Date(wc.start);
    if (start > now) return "—";

    const startDate = toNZDate(wc.start);
    const endDate = toNZDate(wc.end);

    return rows
      .filter((r) => r.date >= startDate && r.date < endDate)
      .reduce((sum, r) => sum + r.views, 0);
  });
}

function toNZDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
}
