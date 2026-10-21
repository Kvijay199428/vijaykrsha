import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { compression, defineAlgorithm } from "vite-plugin-compression2";
import path from "path";
import {
  PRECOMPRESS_EXCLUDE,
  PRECOMPRESS_INCLUDE,
  PRECOMPRESS_THRESHOLD,
} from "./scripts/compression-rules.mjs";

// Precompressed gzip sidecars are opt-in via VITE_PRECOMPRESS=1.
//
// They only pay off on origins we serve ourselves (the nginx frontend image and
// the local dev container), where nginx's gzip_static module hands out the .gz
// byte-for-byte instead of re-compressing on every request. The Cloudflare
// Pages build leaves the flag unset, so dist/ carries no sidecars and the edge
// compresses on the wire. Generating brotli/zstd sidecars is intentionally not
// supported: stock nginx:1.27-alpine cannot serve them. See docs/compression.md.
const precompress = process.env.VITE_PRECOMPRESS === "1";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    tailwindcss(),
    ...(precompress
      ? [
          compression({
            algorithms: [defineAlgorithm("gzip", { level: 9 })],
            threshold: PRECOMPRESS_THRESHOLD,
            include: [PRECOMPRESS_INCLUDE],
            exclude: [PRECOMPRESS_EXCLUDE],
            deleteOriginalAssets: false,
          }),
        ]
      : []),
  ],
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
