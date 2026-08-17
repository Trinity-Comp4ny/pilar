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
});
