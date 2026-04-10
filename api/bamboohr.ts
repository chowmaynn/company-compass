import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const proxyPath = ((req.query.__proxy_path as string) || "").replace(/^\//, "");

  const url = `https://api.bamboohr.com/api/gateway.php/morningsidegroup/v1/${proxyPath}`;
  const apiKey = process.env.BAMBOOHR_API_KEY!;
  const auth = Buffer.from(`${apiKey}:x`).toString("base64");

  const response = await fetch(url, {
    method: req.method || "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  const data = await response.text();
  res.status(response.status).setHeader("Content-Type", "application/json").send(data);
}
