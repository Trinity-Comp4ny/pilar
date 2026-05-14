/* eslint-disable react-hooks/rules-of-hooks */
// `use` é callback do framework Playwright — não um React Hook.
import { test as base, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import fs from "node:fs";

type AuthFixtures = {
  authenticatedPage: Page;
  adminPage: Page;
};

/**
 * Injeta sessão Supabase via localStorage (mesma técnica do auth.setup.ts).
 * Reutiliza storageState já gerado em .auth/admin.json quando disponível,
 * evitando round-trip de auth a cada spec.
 */
async function injectSupabaseSession(page: Page, email: string, password: string): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const baseURL = process.env.BASE_URL ?? "http://localhost:4173";

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "[auth fixtures] VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são obrigatórias."
    );
  }

  const PROD_SUPABASE_REF = "vepnsonbnsimqcsfcagm";
  if (supabaseUrl.includes(PROD_SUPABASE_REF)) {
    throw new Error(
      "[auth fixtures] ABORTANDO: VITE_SUPABASE_URL aponta para o projeto de produção. " +
        "Use staging ou ambiente local."
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`[auth fixtures] Falha no login Supabase: ${error?.message ?? "sem sessão"}`);
  }

  const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  const sessionPayload = JSON.stringify(data.session);

  await page.goto(baseURL);
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
      localStorage.setItem("pilar-remember-me", "true");
    },
    { key: storageKey, value: sessionPayload }
  );
}

export const test = base.extend<AuthFixtures>({
  /**
   * Page autenticada como usuário de teste (E2E_TEST_EMAIL / E2E_TEST_PASSWORD).
   *
   * Se .auth/admin.json existir (gerado pelo auth.setup.ts), o contexto já virá
   * com storageState e este fixture apenas navega para o dashboard.
   * Caso contrário, injeta a sessão programaticamente.
   */
  authenticatedPage: async ({ page }, use) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;

    if (!email || !password) {
      throw new Error(
        "[auth fixtures] E2E_TEST_EMAIL e E2E_TEST_PASSWORD são obrigatórias para testes autenticados."
      );
    }

    const storagePath = path.join(process.cwd(), ".auth", "admin.json");
    const hasStorageState = fs.existsSync(storagePath);

    if (!hasStorageState) {
      // Sem storageState — injeta sessão manualmente.
      await injectSupabaseSession(page, email, password);
    }

    await page.goto("/dashboard");
    // Garante que estamos dentro do app (não caímos na landing).
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await use(page);
  },

  /**
   * Page autenticada como admin (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD).
   * Fallback para E2E_TEST_EMAIL se credenciais de admin não estiverem definidas.
   */
  adminPage: async ({ page }, use) => {
    const email = process.env.E2E_ADMIN_EMAIL ?? process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD ?? process.env.E2E_TEST_PASSWORD;

    if (!email || !password) {
      throw new Error(
        "[auth fixtures] E2E_ADMIN_EMAIL (ou E2E_TEST_EMAIL) é obrigatória para testes de admin."
      );
    }

    await injectSupabaseSession(page, email, password);
    await page.goto("/dashboard");
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
    await use(page);
  },
});

export { expect } from "@playwright/test";
