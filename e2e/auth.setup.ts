import { test as setup, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import fs from "node:fs";
import { generateTotp } from "../src/lib/totp";

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

  // Guarda anti-produção: jamais autenticar contra o projeto Supabase de prod.
  // O ref `vepnsonbnsimqcsfcagm` corresponde ao projeto Pilar produção; testes E2E
  // devem usar staging/local. Se cair aqui, alguém configurou o env errado.
  const PROD_SUPABASE_REF = "vepnsonbnsimqcsfcagm";
  if (supabaseUrl.includes(PROD_SUPABASE_REF)) {
    throw new Error(
      `[auth.setup] ABORTANDO: VITE_SUPABASE_URL aponta para o projeto Supabase de produção (${PROD_SUPABASE_REF}). ` +
        "Testes E2E nunca devem rodar contra produção. Use staging ou ambiente local."
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`[auth.setup] Falha no login Supabase: ${error?.message ?? "sem sessão"}`);
  }

  let session = data.session;

  // O usuário de teste em staging tem MFA obrigatório (mesma regra de qualquer
  // admin, PrivateRoute.tsx) — signInWithPassword só entrega aal1. Sem completar
  // o desafio aqui, a app real redireciona pra /mfa/setup em vez do dashboard.
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) {
    throw new Error(`[auth.setup] Falha ao checar o nível de MFA: ${aalError.message}`);
  }

  if (aal.nextLevel === "aal2" && aal.currentLevel !== aal.nextLevel) {
    const totpSecret = process.env.E2E_TEST_TOTP_SECRET;
    if (!totpSecret) {
      throw new Error(
        "[auth.setup] Este usuário exige MFA (aal2) e E2E_TEST_TOTP_SECRET não foi definida. " +
          "Cadastre o fator TOTP e configure o secret antes de rodar os specs autenticados."
      );
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      throw new Error(`[auth.setup] Falha ao listar fatores de MFA: ${factorsError.message}`);
    }
    const totpFactor = factors.totp[0];
    if (!totpFactor) {
      throw new Error("[auth.setup] Nenhum fator TOTP verificado encontrado para o usuário de teste.");
    }

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: totpFactor.id,
      code: generateTotp(totpSecret),
    });
    if (verifyError) {
      throw new Error(`[auth.setup] Falha ao verificar o código TOTP: ${verifyError.message}`);
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.getSession();
    if (refreshError || !refreshed.session) {
      throw new Error(`[auth.setup] Sessão aal2 não encontrada após o desafio de MFA: ${refreshError?.message ?? ""}`);
    }
    session = refreshed.session;
  }

  // Reproduz a estrutura usada pelo cliente do app (storage-key padrão do supabase-js).
  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  const sessionPayload = JSON.stringify(session);

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
