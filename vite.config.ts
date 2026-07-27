import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-charts": ["recharts"],
          "vendor-maps": ["leaflet", "react-leaflet"],
          "vendor-pdf": ["jspdf", "jspdf-autotable"],
          "vendor-docx": ["docxtemplater", "pizzip", "file-saver"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: ["node_modules", "dist", "e2e/**", "tests/**", ".next", ".git", ".claude/**"],
    // Config mínima de ambiente para a suíte. `src/lib/env.ts` valida no import e
    // aborta sem URL/chave do Supabase, e qualquer teste que importe `supabase.ts`
    // (a maioria, transitivamente) morre sem isto. Na máquina do dev passava por
    // acidente, porque o Vitest carrega o `.env.local`; no CI, que não tem `.env.local`,
    // a suíte inteira quebrou. Valores fake de propósito: teste não fala com Supabase
    // real, e deixar isso explícito aqui evita que a suíte dependa do .env de quem roda.
    env: {
      VITE_SUPABASE_URL: "https://test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
    },
  },
}));
