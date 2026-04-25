import { test, expect } from "@playwright/test";

test.describe("Login — Zod validation", () => {
  test("senha curta bloqueada por Zod", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[type="email"]', "teste@empresa.com");
    await page.fill('input[type="password"]', "123");
    await page.click('button[type="submit"]');

    await expect(page.getByText(/Senha deve ter pelo menos 6 caracteres|Dados inválidos/i)).toBeVisible({
      timeout: 3000,
    });
  });

  test("email inválido bloqueado pelo HTML5/Zod", async ({ page }) => {
    await page.goto("/login");

    // HTML5 bloqueia primeiro — se passar, Zod pega
    await page.fill('input[type="email"]', "sem-arroba");
    await page.fill('input[type="password"]', "senhaDePelo12Menos");
    await page.click('button[type="submit"]');

    // Nao deve navegar pra dashboard
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/\/login/);
  });
});
