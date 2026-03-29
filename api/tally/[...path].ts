import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = (req.query.path as string[])?.join("/") || "";
  const url = `https://api.tally.so/${path}${req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;

  const response = await fetch(url, {
    method: req.method || "GET",
    headers: {
      "Authorization": `Bearer ${process.env.TALLY_TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(req.body ? { body: JSON.stringify(req.body) } : {}),
  });

  const data = await response.text();
  res.status(response.status).setHeader("Content-Type", "application/json").send(data);
}
