import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const proxyPath = ((req.query.__proxy_path as string) || "").replace(/^\//, "");

  const rawUrl = req.url || "";
  const qsStart = rawUrl.indexOf("?");
  let qs = "";
  if (qsStart >= 0) {
    const parts = rawUrl.slice(qsStart + 1).split("&").filter(p =>
      !p.startsWith("__proxy_path=") && !p.startsWith("path=")
    );
    qs = parts.join("&");
  }

  const url = `https://api.tally.so/${proxyPath}${qs ? `?${qs}` : ""}`;

  const response = await fetch(url, {
    method: req.method || "GET",
    headers: {
      "Authorization": `Bearer ${process.env.TALLY_TOKEN}`,
      "Accept": "application/json",
    },
    ...(req.body ? { body: JSON.stringify(req.body) } : {}),
  });

  const data = await response.text();
  res.status(response.status).setHeader("Content-Type", "application/json").send(data);
}
