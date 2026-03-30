import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const proxyPath = ((req.query.__proxy_path as string) || "").replace(/^\//, "");
  const qs = Object.entries(req.query)
    .filter(([k]) => k !== "__proxy_path" && k !== "path")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  const url = `https://api.notion.com/${proxyPath}${qs ? `?${qs}` : ""}`;

  const response = await fetch(url, {
    method: req.method || "GET",
    headers: {
      "Authorization": `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    ...(req.body ? { body: JSON.stringify(req.body) } : {}),
  });

  const data = await response.text();
  res.status(response.status).setHeader("Content-Type", "application/json").send(data);
}
