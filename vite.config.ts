import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
