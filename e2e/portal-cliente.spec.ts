import { test, expect } from "@playwright/test";

test("portal cliente login carrega", async ({ page }) => {
  await page.goto("/cliente/login");
  await expect(page.getByPlaceholder("seu@email.com")).toBeVisible();
  await expect(page.getByRole("button", { name: /Entrar/i })).toBeVisible();
});

test("rota autenticada redireciona sem sessão", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/");
});

test("cliente dashboard redireciona sem token", async ({ page }) => {
  await page.goto("/cliente/dashboard");
  await expect(page).toHaveURL(/\/cliente\/login/);
});
