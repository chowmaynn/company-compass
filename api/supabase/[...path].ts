import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = (req.query.path as string[])?.join("/") || "";
  const url = `https://unelmbldddpwzguttluq.supabase.co/${path}${req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;

  const response = await fetch(url, {
    method: req.method || "POST",
    headers: {
      "apikey": process.env.CALENDLY_SUPABASE_ANON_KEY!,
      "Authorization": `Bearer ${process.env.CALENDLY_SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    ...(req.body ? { body: JSON.stringify(req.body) } : {}),
  });

  const data = await response.text();
  res.status(response.status).setHeader("Content-Type", "application/json").send(data);
}
