import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const proxyPath = ((req.query.__proxy_path as string) || "").replace(/^\//, "");

  // Preserve raw query string (start, end, etc.) and forward to BambooHR.
  const rawUrl = req.url || "";
  const qsStart = rawUrl.indexOf("?");
  let qs = "";
  if (qsStart >= 0) {
    const parts = rawUrl.slice(qsStart + 1).split("&").filter((p) =>
      !p.startsWith("__proxy_path=") && !p.startsWith("path=")
    );
    qs = parts.join("&");
  }

  const url = `https://api.bamboohr.com/api/gateway.php/morningsidegroup/v1/${proxyPath}${qs ? `?${qs}` : ""}`;
  const apiKey = process.env.BAMBOOHR_API_KEY!;
  const auth = Buffer.from(`${apiKey}:x`).toString("base64");

  const fetchOptions: RequestInit = {
    method: req.method || "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  };

  // Forward request body for POST/PUT/PATCH
  if (req.body && req.method && ["POST", "PUT", "PATCH"].includes(req.method)) {
    fetchOptions.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  const response = await fetch(url, fetchOptions);

  const data = await response.text();
  res.status(response.status).setHeader("Content-Type", "application/json").send(data);
}
