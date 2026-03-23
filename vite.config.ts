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
      "/api/calendly": {
        target: "https://api.calendly.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/calendly/, ""),
        headers: {
          "Authorization": "Bearer eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzc0MTMxNTg5LCJqdGkiOiIyYzVlYTBiOS1mOTdhLTRkZDctYWQyYi1kZWVjODE5MGZjNDQiLCJ1c2VyX3V1aWQiOiIxY2ViNTMwZi1jMTNjLTQzZjItOTM5MS01MzZlYmZhMzI3MGIiLCJzY29wZSI6ImF2YWlsYWJpbGl0eTpyZWFkIGF2YWlsYWJpbGl0eTp3cml0ZSBldmVudF90eXBlczpyZWFkIGV2ZW50X3R5cGVzOndyaXRlIGxvY2F0aW9uczpyZWFkIHJvdXRpbmdfZm9ybXM6cmVhZCBzaGFyZXM6d3JpdGUgc2NoZWR1bGVkX2V2ZW50czpyZWFkIHNjaGVkdWxlZF9ldmVudHM6d3JpdGUgc2NoZWR1bGluZ19saW5rczp3cml0ZSBncm91cHM6cmVhZCBvcmdhbml6YXRpb25zOnJlYWQgb3JnYW5pemF0aW9uczp3cml0ZSB1c2VyczpyZWFkIGFjdGl2aXR5X2xvZzpyZWFkIGRhdGFfY29tcGxpYW5jZTp3cml0ZSBvdXRnb2luZ19jb21tdW5pY2F0aW9uczpyZWFkIHdlYmhvb2tzOnJlYWQgd2ViaG9va3M6d3JpdGUifQ.lUwuNSwzH80vp9OSot0mDhMnYNJ3gZjmyOkBlvcEvvtCTz8BwxkhIQ8kdypNY4oYTTMcqRZoHjqMYs3c11szUw",
        },
      },
      "/api/close": {
        target: "https://api.close.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/close/, "/api/v1"),
        headers: {
          "Authorization": "Basic YXBpXzZSNExWeml6eWN2YkJPbWNPQmxXemQuMkd1eUpXNlNZN2JCc3c3dTB2Znk4bzo=",
        },
      },
      "/api/circle": {
        target: "https://app.circle.so",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/circle/, "/api"),
        headers: {
          "Authorization": "Token dNADRjgHHoTcAzvxY5yoHY2ae5QTp1bX",
        },
      },
      "/api/supabase": {
        target: "https://unelmbldddpwzguttluq.supabase.co",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/supabase/, ""),
        headers: {
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuZWxtYmxkZGRwd3pndXR0bHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzNTY1NzMsImV4cCI6MjA1NTkzMjU3M30.6bOg3C-FQgMKIYeR1Xs2dRlXK_PnkWWBM9qYZm4iGxs",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuZWxtYmxkZGRwd3pndXR0bHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzNTY1NzMsImV4cCI6MjA1NTkzMjU3M30.6bOg3C-FQgMKIYeR1Xs2dRlXK_PnkWWBM9qYZm4iGxs",
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
}));
