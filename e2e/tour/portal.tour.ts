import { test } from "@playwright/test";
import { Tour } from "./explorar";

// Portal do Cliente: entra com a conta do seed (portal@local.test) num contexto limpo.
const ID = "00000000-0000-0000-0000-000000000";
const ROTAS: [string, string][] = [
  ["dashboard", "/cliente/dashboard"],
  ["projeto", `/cliente/projeto/${ID}401`],
  ["projeto-financeiro", `/cliente/projeto/${ID}401/financeiro`],
  ["projeto-entregas", `/cliente/projeto/${ID}401/entregas`],
  ["projeto-arquivos", `/cliente/projeto/${ID}401/arquivos`],
  ["obra", `/cliente/obra/${ID}a01`],
];

test("portal · cliente", async ({ browser }) => {
  test.setTimeout(12 * 60_000);
  const ctx = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 1440, height: 900 },
    locale: "pt-BR",
  });
  await ctx.addInitScript(() => {
    const v = encodeURIComponent(JSON.stringify({ analytics: false, decidedAt: new Date().toISOString() }));
    document.cookie = `pilar_cookie_consent=${v}; path=/; max-age=31536000; samesite=lax`;
  });
  const page = await ctx.newPage();
  await page.goto("/cliente/login");
  await page.getByPlaceholder("seu@email.com").fill(process.env.E2E_PORTAL_EMAIL ?? "portal@local.test");
  await page.getByPlaceholder("••••••••").first().fill(process.env.E2E_PORTAL_PASSWORD ?? "123456");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/cliente\/(dashboard|projeto|obra)/, { timeout: 20_000 }).catch(() => undefined);
  for (const [tela, rota] of ROTAS) {
    await new Tour(page, "portal", tela, rota, { orcamentoMs: 80_000, maxProf: 1 }).rodar();
  }
  await ctx.close();
});
