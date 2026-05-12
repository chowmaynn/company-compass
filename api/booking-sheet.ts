import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Server-side proxy for the Booking Sheet Apps Script web app.
 *
 * The browser can't hit script.google.com directly because Apps Script doesn't
 * send CORS headers. This function fetches it server-side, follows the
 * redirect into script.googleusercontent.com, and returns the JSON.
 *
 * Env (set in Vercel project settings):
 *   BOOKING_SHEET_URL   — Apps Script /exec deployment URL
 *   BOOKING_SHEET_TOKEN — the random token configured in the script
 * Falls back to VITE_BOOKING_SHEET_URL / VITE_BOOKING_SHEET_TOKEN so the
 * existing env vars keep working without a rename.
 */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const url = process.env.BOOKING_SHEET_URL || process.env.VITE_BOOKING_SHEET_URL;
  const token = process.env.BOOKING_SHEET_TOKEN || process.env.VITE_BOOKING_SHEET_TOKEN;

  if (!url || !token) {
    res.status(500).json({ error: "BOOKING_SHEET_URL / BOOKING_SHEET_TOKEN not configured" });
    return;
  }

  try {
    const response = await fetch(`${url}?token=${encodeURIComponent(token)}`, {
      redirect: "follow",
    });
    const body = await response.text();
    res
      .status(response.status)
      .setHeader("Content-Type", "application/json")
      .setHeader("Cache-Control", "public, max-age=60") // 1 min edge cache
      .send(body);
  } catch (err) {
    res.status(502).json({ error: String(err) });
  }
}
