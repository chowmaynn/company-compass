import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
            "apikey": env.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${env.SUPABASE_ANON_KEY}`,
          },
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
