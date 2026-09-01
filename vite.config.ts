import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "path";

// Commit real do deploy (setado pela Vercel). Sem isso, todo erro em prod chega
// com "release: undefined" no Sentry e não dá pra saber qual deploy introduziu o bug.
const SENTRY_RELEASE = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.SENTRY_RELEASE ?? "dev";

// Separa staging de produção no Sentry sem exigir configurar VITE_SENTRY_ENV
// manualmente por ambiente na Vercel: VERCEL_ENV já vem "production"/"preview"
// de graça em todo build (preview cobre staging e qualquer PR preview). Fora da
// Vercel (build local), cai em "development". Ver ADR 0036.
const SENTRY_ENVIRONMENT = process.env.VERCEL_ENV ?? process.env.SENTRY_ENV ?? "development";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // Sourcemap upload só roda com token presente (build local/dev nunca tem).
    // Sem authToken o plugin não falha o build, só pula o upload — mas manter o
    // guard explícito evita rodar em `vite dev`/testes onde não faz sentido.
    mode === "production" &&
      process.env.SENTRY_AUTH_TOKEN &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG ?? "trinity-company",
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {
          name: SENTRY_RELEASE,
          // Marca o release como deployado (timeline em Releases > deploys), sem
          // precisar de step próprio no CI: o front é buildado direto pela Vercel
          // (ci.yml só cobre o backend Supabase), então isto roda em todo build.
          deploy: { env: SENTRY_ENVIRONMENT },
        },
        // Sobe o .map pro Sentry pra desmascarar o stack trace, depois apaga do
        // dist: sourcemap de produção não precisa ficar servível publicamente.
        sourcemaps: { filesToDeleteAfterUpload: ["dist/**/*.map"] },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __SENTRY_RELEASE__: JSON.stringify(SENTRY_RELEASE),
    __SENTRY_ENVIRONMENT__: JSON.stringify(SENTRY_ENVIRONMENT),
  },
  // Pré-otimiza os deps que só entram via import() (exportação de relatórios). Sem
  // isto, o Vite os descobre em voo no primeiro uso, re-otimiza o cache e troca os
  // hashes, derrubando outro import dinâmico em andamento ("Failed to fetch
  // dynamically imported module"). Só afeta o dev server.
  optimizeDeps: {
    include: ["jspdf", "jspdf-autotable", "pizzip"],
  },
  build: {
    // Necessário pro sentryVitePlugin ter o que subir. É apagado do dist depois
    // do upload (ver plugin acima), então não fica servido em produção.
    sourcemap: true,
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
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // Foco onde a corretude importa e dá pra medir: regras de negócio (lib) e o
      // módulo financeiro. Não medimos o app inteiro ainda; a meta é ter número
      // de linha de base antes de exigir piso no CI.
      include: ["src/lib/**", "src/pages/financeiro/**"],
      // Ainda sem `thresholds` que reprovem o CI: primeiro medir, depois travar.
      // Quando a base estiver mapeada, subir um piso para o financeiro, ex.:
      // thresholds: {
      //   "src/pages/financeiro/**": { statements: 20, branches: 20, functions: 20, lines: 20 },
      // },
    },
  },
}));
