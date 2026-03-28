/**
 * Shared Close.com API helpers — used by both use-close.ts and use-rep-metrics.ts.
 */

const BASE = "/api/close";

/** Fetch a single Close API endpoint via our proxy. */
export async function closeFetch(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Close API ${res.status}`);
  return res.json();
}

/** Paginate through Close API results. Returns all records. */
export async function closePaginateAll(
  basePath: string,
  limit = 100,
): Promise<{ data: any[]; total_results: number }> {
  const all: any[] = [];
  let offset = 0;
  let total = 0;
  for (let page = 0; page < 10; page++) {
    const sep = basePath.includes("?") ? "&" : "?";
    const res = await closeFetch(
      `${basePath}${sep}_limit=${limit}&_skip=${offset}`,
    );
    all.push(...(res.data ?? []));
    total = res.total_results ?? all.length;
    if (all.length >= total) break;
    offset = all.length;
  }
  return { data: all, total_results: total };
}
