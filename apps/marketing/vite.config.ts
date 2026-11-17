import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// App de marketing separado do produto (ADR 0021): sem Supabase, React Query,
// Sentry ou PostHog no bundle inicial. Ver docs/specs/043-marketing-site-separado.md.
export default defineConfig({
  server: {
    host: "::",
    port: 8081,
  },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas em chunks próprios: baixam em paralelo (em vez de uma
        // cadeia de 140 KiB) e ficam em cache entre deploys, porque só o código
        // da landing muda a cada release.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor-react";
          if (/node_modules\/(react-router|react-router-dom|@remix-run)\//.test(id)) return "vendor-router";
          if (/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(id)) return "vendor-motion";
          return undefined;
        },
      },
    },
  },
});
