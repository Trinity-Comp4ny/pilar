import { test, expect, type Page } from "@playwright/test";

/**
 * Rotas públicas depois do upgrade do React Router 6 → 7 (13/10).
 *
 * O upgrade passou no CI, mas nenhum spec cobria os cantos de maior risco de um
 * major de router: link legado com splat, rota que não existe, entrada direta
 * (deep link) em tela de auth e o voltar/avançar do navegador. Roda sem sessão,
 * no projeto "chromium".
 */

function coletarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("pageerror", (err) => erros.push(String(err)));
  return erros;
}

test.describe("Rotas públicas (React Router 7)", () => {
  test("link antigo do portal por token cai no login do cliente", async ({ page }) => {
    const erros = coletarErros(page);
    await page.goto("/portal/token-antigo/projeto/123");
    await expect(page).toHaveURL(/\/cliente\/login$/);
    await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
    expect(erros).toHaveLength(0);
  });

  test("rota inexistente mostra a 404 com o caminho digitado", async ({ page }) => {
    const erros = coletarErros(page);
    await page.goto("/rota-que-nao-existe/abc?x=1");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
    await expect(page.getByText("/rota-que-nao-existe/abc")).toBeVisible();
    expect(erros).toHaveLength(0);
  });

  for (const { path, heading } of [
    { path: "/forgot-password", heading: "Recuperar senha" },
    { path: "/campo/login", heading: "Pilar Campo" },
  ]) {
    test(`entrada direta em ${path} renderiza a tela`, async ({ page }) => {
      const erros = coletarErros(page);
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      expect(erros).toHaveLength(0);
    });
  }

  test("entrada direta em /reset-password não cai na 404", async ({ page }) => {
    const erros = coletarErros(page);
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).not.toBeVisible();
    expect(erros).toHaveLength(0);
  });

  test("voltar e avançar do navegador trocam a tela", async ({ page }) => {
    const erros = coletarErros(page);
    await page.goto("/login");
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[type="email"]')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
    expect(erros).toHaveLength(0);
  });
});
