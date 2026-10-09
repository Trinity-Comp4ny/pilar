import { expect, type Browser, type Page } from "@playwright/test";

/**
 * Abre um contexto novo (sem a sessão do admin do auth.setup) e entra pelo
 * formulário de login com outro usuário do seed local. Serve para conferir a tela
 * pelo olhar de um papel específico (ADR 0046, matriz de acesso).
 */
export async function loginComo(browser: Browser, email: string, senha = "123456"): Promise<Page> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("seu@empresa.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(senha);
  await page.locator('button[type="submit"]').click();
  await expect(page.locator("#main-content"), `Login de ${email} não chegou no app`).toBeVisible({
    timeout: 15_000,
  });
  return page;
}
