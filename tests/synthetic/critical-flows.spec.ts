/**
 * Synthetic checks rodados pelo Checkly — NÃO são testes unitários nem E2E reais.
 *
 * Regras:
 *  - Sem credenciais reais no spec. Login flow só verifica que a tela carrega
 *    e o form responde — não tenta autenticar com user real (use API check
 *    separado pra isso, com user dedicado de monitoring).
 *  - Curtos (<30s cada).
 *  - Idempotentes — não criam dado.
 */

import { expect, test } from "@playwright/test";

const BASE_URL = process.env.PILAR_BASE_URL ?? "https://app.pilarsoft.com.br";
const HEALTH_URL = process.env.PILAR_HEALTH_URL ?? `${BASE_URL.replace(/\/$/, "")}/functions/v1/health`;

test.describe("pilar critical flows", () => {
  test("health endpoint returns ok or degraded", async ({ request }) => {
    const res = await request.get(HEALTH_URL, { timeout: 10_000 });
    expect(res.status(), "health http").toBeLessThan(500);
    const body = await res.json();
    expect(body.status, "health status").toMatch(/^(ok|degraded)$/);
    expect(body.checks?.db, "db check").toBe("ok");
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
});
