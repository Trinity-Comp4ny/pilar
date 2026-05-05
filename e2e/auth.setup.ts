import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import fs from "node:fs";

/**
 * Auth setup — login programático via Supabase API.
 *
 * Faz signInWithPassword usando as credenciais de teste e injeta o token
 * resultante no localStorage do browser. Em seguida persiste o storageState
 * em `.auth/admin.json` para reuso pelos specs do projeto "authenticated".
 *
 * Como rodar localmente:
 *   export VITE_SUPABASE_URL=https://xxx.supabase.co
 *   export VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
 *   export E2E_TEST_EMAIL=admin-e2e@pilar.test
 *   export E2E_TEST_PASSWORD=sua-senha-segura
 *   npx playwright test
 */

const STORAGE_PATH = path.join(process.cwd(), ".auth", "admin.json");

setup("authenticate as admin", async ({ page, baseURL }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!email || !password) {
    throw new Error(
      "[auth.setup] E2E_TEST_EMAIL e E2E_TEST_PASSWORD são obrigatórias. " +
        "Defina como variáveis de ambiente antes de rodar `npx playwright test`."
    );
  }

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "[auth.setup] VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias. " +
        "Carregue seu .env antes de rodar (ex.: `set -a && source .env && set +a`)."
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`[auth.setup] Falha no login Supabase: ${error?.message ?? "sem sessão"}`);
  }

  // Reproduz a estrutura usada pelo cliente do app (storage-key padrão do supabase-js).
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  const sessionPayload = JSON.stringify(data.session);

  // Carrega a página primeiro para ter origin, depois injeta sessão e revalida.
  await page.goto(baseURL ?? "/");
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
      // Garante que o adaptive storage do app trate como "lembrar-me"
      localStorage.setItem("pilar-remember-me", "true");
    },
    { key: storageKey, value: sessionPayload }
  );

  await page.goto("/dashboard");
  // Não dependemos de h1 específico — só garantimos que não fomos jogados pra landing.
  await expect(page).not.toHaveURL(/^\/$/);

  fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true });
  await page.context().storageState({ path: STORAGE_PATH });
});
