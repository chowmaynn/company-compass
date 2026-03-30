import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const proxyPath = ((req.query.__proxy_path as string) || "").replace(/^\//, "");
  const qs = Object.entries(req.query)
    .filter(([k]) => k !== "__proxy_path" && k !== "path")
    .map(([k, v]) => `${k}=${String(v)}`)
    .join("&");
  const url = `https://api.stripe.com/${proxyPath}${qs ? `?${qs}` : ""}`;
  const auth = Buffer.from(process.env.STRIPE_SECRET_KEY + ":").toString("base64");

  const response = await fetch(url, {
    method: req.method || "GET",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    ...(req.body ? { body: JSON.stringify(req.body) } : {}),
  });

  const data = await response.text();
  res.status(response.status).setHeader("Content-Type", "application/json").send(data);
}
