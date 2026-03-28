import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import crypto from "crypto";
import { componentTagger } from "lovable-tagger";

// --- GA4 Service Account Token Exchange ---
function createGA4Middleware(env: Record<string, string>) {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) return null;

  // Unescape \\n → real newlines
  const privateKey = rawKey.replace(/\\n/g, "\n");
  let cachedToken: string | null = null;
  let tokenExpiry = 0;

  async function getAccessToken(): Promise<string> {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })).toString("base64url");

    const signature = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), privateKey);
    const jwt = `${header}.${payload}.${signature.toString("base64url")}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
    const data = await res.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return cachedToken!;
  }

  return {
    name: "ga4-proxy",
    configureServer(server: any) {
      server.middlewares.use("/api/ga4", async (req: any, res: any) => {
        try {
          const token = await getAccessToken();
          const chunks: Buffer[] = [];
          req.on("data", (c: Buffer) => chunks.push(c));
          req.on("end", async () => {
            const body = Buffer.concat(chunks).toString();
            const gaUrl = `https://analyticsdata.googleapis.com/v1beta${req.url}`;
            const gaRes = await fetch(gaUrl, {
              method: req.method || "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              ...(body ? { body } : {}),
            });
            const gaData = await gaRes.text();
            res.writeHead(gaRes.status, { "Content-Type": "application/json" });
            res.end(gaData);
          });
        } catch (err: any) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/api/notion": {
          target: "https://api.notion.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/notion/, ""),
          headers: {
            "Notion-Version": "2022-06-28",
          },
        },
        "/api/kit": {
          target: "https://api.kit.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/kit/, ""),
        },
        "/api/calendly": {
          target: "https://api.calendly.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/calendly/, ""),
          headers: {
            "Authorization": `Bearer ${env.CALENDLY_TOKEN}`,
          },
        },
        "/api/close": {
          target: "https://api.close.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/close/, "/api/v1"),
          headers: {
            "Authorization": `Basic ${env.CLOSE_BASIC}`,
          },
        },
        "/api/circle": {
          target: "https://app.circle.so",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/circle/, "/api"),
          headers: {
            "Authorization": `Token ${env.CIRCLE_TOKEN}`,
          },
        },
        "/api/airtable": {
          target: "https://api.airtable.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/airtable/, ""),
          headers: {
            "Authorization": `Bearer ${env.AIRTABLE_TOKEN}`,
          },
        },
        "/api/tally": {
          target: "https://api.tally.so",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/tally/, ""),
          headers: {
            "Authorization": `Bearer ${env.TALLY_TOKEN}`,
          },
        },
        "/api/intercom": {
          target: "https://api.intercom.io",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/intercom/, ""),
          headers: {
            "Authorization": `Bearer ${env.INTERCOM_TOKEN}`,
            "Accept": "application/json",
          },
        },
        "/api/stripe": {
          target: "https://api.stripe.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/stripe/, ""),
          headers: {
            "Authorization": `Basic ${Buffer.from(env.STRIPE_SECRET_KEY + ":").toString("base64")}`,
          },
        },
        "/api/supabase": {
          target: "https://unelmbldddpwzguttluq.supabase.co",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/supabase/, ""),
          headers: {
            "apikey": env.CALENDLY_SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${env.CALENDLY_SUPABASE_ANON_KEY}`,
          },
        },
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      createGA4Middleware(env),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
