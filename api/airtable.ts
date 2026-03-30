import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const proxyPath = ((req.query.__proxy_path as string) || "").replace(/^\//, "");

  // Use raw URL to preserve bracket-notation params (fields[], sort[0][field], etc.)
  const rawUrl = req.url || "";
  const qsStart = rawUrl.indexOf("?");
  let qs = "";
  if (qsStart >= 0) {
    // Parse and remove only proxy-injected params, keep everything else raw
    const rawQs = rawUrl.slice(qsStart + 1);
    const parts = rawQs.split("&").filter(p =>
      !p.startsWith("__proxy_path=") && !p.startsWith("path=")
    );
    qs = parts.join("&");
  }

  const url = `https://api.airtable.com/${proxyPath}${qs ? `?${qs}` : ""}`;

  const response = await fetch(url, {
    method: req.method || "GET",
    headers: {
      "Authorization": `Bearer ${process.env.AIRTABLE_TOKEN}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    ...(req.body ? { body: JSON.stringify(req.body) } : {}),
  });

  const data = await response.text();
  res.status(response.status).setHeader("Content-Type", "application/json").send(data);
}
