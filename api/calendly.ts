import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const proxyPath = ((req.query.__proxy_path as string) || "").replace(/^\//, "");

  // Rebuild query string properly with URL encoding
  const target = new URL(`https://api.calendly.com/${proxyPath}`);
  for (const [k, v] of Object.entries(req.query)) {
    if (k === "__proxy_path" || k === "path") continue;
    target.searchParams.set(k, String(v));
  }

  const response = await fetch(target.toString(), {
    method: req.method || "GET",
    headers: {
      "Authorization": `Bearer ${process.env.CALENDLY_TOKEN}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    ...(req.body ? { body: JSON.stringify(req.body) } : {}),
  });

  const data = await response.text();
  res.status(response.status).setHeader("Content-Type", "application/json").send(data);
}
