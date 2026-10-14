/**
 * Checks sintéticos de PRODUÇÃO, rodados a cada 10 min pelo workflow
 * monitor-producao.yml (config em tests/synthetic/playwright.config.ts). Não são E2E.
 *
 * Regras:
 *  - Credencial só por variável de ambiente (secret do GitHub), nunca no spec. O login
 *    real usa o usuário de monitor (empresa própria, isenta, sem dado de cliente).
 *  - Curtos (<30s cada).
 *  - Idempotentes: entram e leem, não criam dado.
 */

import { expect, test } from "@playwright/test";

const BASE_URL = process.env.PILAR_BASE_URL ?? "https://app.pilarsoft.com.br";
// A Edge Function vive no domínio do Supabase, não no do app. O default antigo
// (`${BASE_URL}/functions/v1/health`) caía no SPA e o check nunca teria passado.
const HEALTH_URL = process.env.PILAR_HEALTH_URL ?? "https://vepnsonbnsimqcsfcagm.supabase.co/functions/v1/health";

test.describe("pilar critical flows", () => {
  test("health endpoint returns ok or degraded", async ({ request }) => {
    const res = await request.get(HEALTH_URL, { timeout: 10_000 });
    expect(res.status(), "health http").toBeLessThan(500);
    const body = await res.json();
    expect(body.status, "health status").toMatch(/^(ok|degraded)$/);
    expect(body.checks?.db, "db check").toBe("ok");
    // SPEC 105: sem banco ou autenticação ninguém usa o app.
    expect(body.componentes?.banco, "componente banco").toBe("ok");
    expect(body.componentes?.autenticacao, "componente autenticação").toBe("ok");
    expect(typeof body.latency_ms?.db, "db latency").toBe("number");
    expect(body.latency_ms.db, "db latency under 1s").toBeLessThan(1000);
  });

  test("landing page loads", async ({ page }) => {
    const response = await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 15_000 });
    expect(response?.status(), "landing http").toBeLessThan(400);
    await expect(page).toHaveTitle(/pilar/i, { timeout: 5_000 });
  });

  test("login screen renders form", async ({ page }) => {
    await page.goto(`${BASE_URL.replace(/\/$/, "")}/login`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("dashboard route guards unauth users (no 5xx)", async ({ page }) => {
    const res = await page.goto(`${BASE_URL.replace(/\/$/, "")}/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    // SPA: server retorna 200 e o router redireciona — só falha se 5xx.
    expect(res?.status() ?? 200, "dashboard http").toBeLessThan(500);
  });

  test("login real chega no app", async ({ page }) => {
    const email = process.env.PILAR_MONITOR_EMAIL;
    const senha = process.env.PILAR_MONITOR_PASSWORD;
    test.skip(!email || !senha, "Sem usuário de monitor (PILAR_MONITOR_EMAIL / PILAR_MONITOR_PASSWORD)");

    await page.goto(`${BASE_URL.replace(/\/$/, "")}/login`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.locator('input[type="email"]').fill(email!);
    await page.locator('input[type="password"]').fill(senha!);
    await page.locator('button[type="submit"]').click();
    // #main-content só existe dentro do app: tela de bloqueio, setup ou erro não têm.
    await expect(page.locator("#main-content"), "login não chegou no app").toBeVisible({ timeout: 20_000 });
  });
});
