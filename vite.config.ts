import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    hmr: { clientPort: 443 },
    proxy: {
      // Dev only: forward /api to the local FastAPI backend.
      // Production routes /api through the Cloudflare Pages function instead.
      "/api": {
        target: process.env.VITE_API_ORIGIN || "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
