import { defineConfig, mergeConfig, type UserConfig } from "vite";
import baseConfig from "./vite.config";
import { supabaseMock, MOCK_PREFIX } from "./scripts/dev-mock/plugin.mjs";

/**
 * Ambiente de tela ao vivo sem Docker: o mesmo app, com o Supabase simulado dentro do
 * Vite (scripts/dev-mock). `npm run dev:mock`, abre em http://localhost:8081.
 * Ver docs/design/DEV_MOCK.md.
 */
export default defineConfig((env) => {
  const base = typeof baseConfig === "function" ? baseConfig(env) : baseConfig;
  return mergeConfig(base as UserConfig, {
    server: { host: "localhost", port: 8081, strictPort: true },
    plugins: [supabaseMock()],
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(`http://localhost:8081${MOCK_PREFIX}`),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("sb_publishable_mock"),
    },
  });
});
