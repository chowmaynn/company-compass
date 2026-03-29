import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = (req.query.path as string[])?.join("/") || "";
  const url = `https://api.stripe.com/${path}${req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;

  const auth = Buffer.from(process.env.STRIPE_SECRET_KEY + ":").toString("base64");

  const response = await fetch(url, {
    method: req.method || "GET",
    headers: {
      "Authorization": `Basic ${auth}`,
    },
    ...(req.body ? { body: JSON.stringify(req.body) } : {}),
  });

  const data = await response.text();
  res.status(response.status).setHeader("Content-Type", "application/json").send(data);
}
