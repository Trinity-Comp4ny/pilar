import { defineConfig, type Plugin } from "vite";
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

// Escreve o SHA do deploy num arquivo que o app busca sem cache pra saber que
// já existe versão mais nova que a do bundle carregado (ver useNovaVersao).
// Sem isto, uma aba aberta segue rodando bundle antigo por dias: foi assim que
// uma conta ficou batendo 403 depois de uma migration de hardening.
function emitVersionJson(): Plugin {
  return {
    name: "pilar-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ release: SENTRY_RELEASE }),
      });
    },
  };
}

// https://vitejs.dev/config/

/** Pacote do node_modules a que um módulo pertence ("@radix-ui/react-dialog", "recharts"). */
function pacoteDoModulo(id: string): string | undefined {
  const depois = id.split("node_modules/").pop();
  if (!depois || depois === id) return undefined;
  const partes = depois.split("/");
  return partes[0].startsWith("@") ? `${partes[0]}/${partes[1]}` : partes[0];
}

const CHUNK_DO_PACOTE: Record<string, string> = {
  // Helpers usados pelo app inteiro E por bibliotecas pesadas. Sem dono explícito, o
  // Rollup os coloca no chunk da primeira biblioteca que os puxa (o de PDF, o de
  // gráficos), e a entrada passa a depender daquele chunk.
  "@babel/runtime": "vendor-styles",
  clsx: "vendor-styles",
  "tailwind-merge": "vendor-styles",
  react: "vendor-react",
  "react-dom": "vendor-react",
  "react-router-dom": "vendor-react",
  "react-router": "vendor-react",
  scheduler: "vendor-react",
  recharts: "vendor-charts",
  "victory-vendor": "vendor-charts",
  leaflet: "vendor-maps",
  "react-leaflet": "vendor-maps",
  jspdf: "vendor-pdf",
  "jspdf-autotable": "vendor-pdf",
  docxtemplater: "vendor-docx",
  pizzip: "vendor-docx",
  "@supabase/supabase-js": "vendor-supabase",
  "@tanstack/react-query": "vendor-query",
  "@tanstack/query-core": "vendor-query",
  "@radix-ui/react-dialog": "vendor-ui",
  "@radix-ui/react-popover": "vendor-ui",
  "@radix-ui/react-select": "vendor-ui",
  "@radix-ui/react-dropdown-menu": "vendor-ui",
  "@radix-ui/react-tabs": "vendor-ui",
  "@radix-ui/react-tooltip": "vendor-ui",
};

// Cobertura por criticidade (ver thresholds abaixo): acesso, autenticação e dinheiro.
const PISO_CRITICO = { statements: 85, branches: 65, functions: 80, lines: 85 };
const CRITICOS = Object.fromEntries(
  [
    // acesso
    "src/lib/permissions.ts",
    "src/lib/roles.ts",
    "src/lib/features.ts",
    "src/hooks/usePermissions.ts",
    "src/hooks/useFeatureAccess.ts",
    // autenticação
    "src/lib/authErrors.ts",
    "src/lib/totp.ts",
    // dinheiro e prazo
    "src/lib/format.ts",
    "src/lib/cobranca.ts",
    "src/lib/currencyUtils.ts",
    "src/lib/cronograma.ts",
    "src/pages/financeiro/lib/importFinanceiro.ts",
  ].map((arquivo) => [arquivo, PISO_CRITICO])
);

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    emitVersionJson(),
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
        // O Rollup leva para um chunk manual também as dependências sem chunk próprio,
        // inclusive as que o resto do app usa (helper de transpilação, clsx). A entrada
        // passava a importar esses helpers de dentro do vendor-pdf e do vendor-charts, e
        // toda página baixava ~860 KB de PDF e gráficos antes de abrir (medido no Sentry
        // em 2026-10-09). O mapa abaixo dá dono aos helpers compartilhados; o teste
        // build-chunks garante que PDF, gráficos, mapas e docx não voltem à entrada.
        manualChunks(id) {
          // Helper de import() do Vite: o jspdf faz import dinâmico (html2canvas), e sem
          // dono o helper caía no vendor-pdf; como toda tela lazy usa o helper, a entrada
          // passava a carregar o PDF.
          if (id.includes("vite/preload-helper")) return "vendor-styles";
          const pacote = pacoteDoModulo(id);
          return pacote ? CHUNK_DO_PACOTE[pacote] : undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    // supabase/functions roda em Deno (deno test, `npm run test:functions`), não em
    // Vitest: os arquivos .test.ts de lá importam módulo remoto (https://) e usam API
    // só do Deno, que o loader ESM do Node não resolve.
    exclude: ["node_modules", "dist", "e2e/**", "tests/**", ".next", ".git", ".claude/**", "supabase/functions/**"],
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
      // Foco onde a corretude importa e dá pra medir: regras de negócio (lib), os
      // módulos de maior risco (financeiro, obras, projetos) e a camada compartilhada
      // (hooks, components). Ainda fora: as demais telas, cobertas por E2E.
      include: [
        "src/lib/**",
        "src/hooks/**",
        "src/components/**",
        "src/pages/financeiro/**",
        "src/pages/obras/**",
        "src/pages/projetos/**",
        // Hooks de módulo (ADR 0055): medidos juntos, onde quer que o módulo esteja.
        "src/pages/*/hooks/**",
      ],
      // Piso que reprova o CI (catraca, não meta). Medido em 07/10: lib em 70/66/71/72
      // (statements/branches/functions/lines) e financeiro em 5/6/4/4. O piso fica um
      // pouco abaixo do medido para refactor pequeno não reprovar; a regra é só subir.
      // Quando um módulo ganhar teste, subir o número dele no mesmo PR. Tela do
      // financeiro é coberta por E2E (e2e/financeiro-*), por isso o piso baixo.
      // Hooks, components, obras e projetos entraram na medição em 13/10 com o piso
      // logo abaixo do medido (12/9/10/13, 22/19/17/22, 9/7/8/9 e 6/4/5/6).
      // Ainda em 13/10, os hooks do Obras saíram de src/hooks para src/pages/obras/hooks
      // (só mudou o denominador, nenhum teste saiu): hooks subiu para 16/12/14/17 e obras
      // desceu para 6/6/6/7. Os dois pisos acompanharam a mudança.
      // Financeiro subiu de 5/6/4/4 para 14/12/8/14 em 13/10 (hooks de contas, fatura e importação).
      // Ainda em 13/10, o resto dos hooks de um módulo só saiu de src/hooks (ADR 0055).
      // Os testados (painel do início, formulário persistido, dashboard) foram junto, então
      // src/hooks desceu para 13/9/11/13 e o grupo novo src/pages/*/hooks ficou em
      // 16/12/12/18; financeiro subiu para 16/13/11/16 e projetos para 7/4/5/7.
      // Ainda em 13/10 (ADR 0055, guarda em scripts/arquitetura-front.test.ts): 11 arquivos de
      // um módulo só desceram de src/lib e src/components para o módulo, e os testes de
      // acesso e autenticação entraram. Medido: lib 72/70/72/74, hooks 15/12/13/16,
      // components 22/20/17/22, financeiro 21/17/13/21, obras 13/12/9/13, projetos 8/5/7/8.
      thresholds: {
        "src/lib/**": { statements: 70, branches: 68, functions: 70, lines: 72 },
        "src/hooks/**": { statements: 14, branches: 10, functions: 12, lines: 15 },
        "src/pages/*/hooks/**": { statements: 15, branches: 11, functions: 11, lines: 17 },
        "src/components/**": { statements: 21, branches: 19, functions: 16, lines: 22 },
        "src/pages/financeiro/**": { statements: 20, branches: 16, functions: 12, lines: 20 },
        "src/pages/obras/**": { statements: 12, branches: 11, functions: 8, lines: 12 },
        "src/pages/projetos/**": { statements: 7, branches: 4, functions: 6, lines: 7 },
        // Por criticidade, não por pasta: arquivo que decide acesso, autentica ou mexe
        // com dinheiro tem piso próprio, alto, para não se esconder na média da pasta.
        // Uma entrada por arquivo de propósito: `perFile` dentro de glob agrega (medido
        // em 13/10). Medido em 13/10 e piso logo abaixo; arquivo crítico novo entra aqui.
        ...CRITICOS,
      },
    },
  },
}));
