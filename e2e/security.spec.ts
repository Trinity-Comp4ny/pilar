import { test, expect } from "@playwright/test";

/**
 * Smoke tests de segurança — rodam sem auth fixture.
 * Validam que PrivateRoute / Cliente Portal Auth bloqueiam acesso anônimo.
 */

test.describe("Security — rotas autenticadas bloqueadas sem sessão", () => {
  const protectedPaths = [
    "/dashboard",
    "/projetos",
    "/clientes",
    "/leads",
    "/equipe",
    "/financeiro",
    "/admin",
    "/ultra-admin",
    "/billing",
    "/company",
    "/templates",
    "/mapa",
    "/documentos",
  ];

  for (const path of protectedPaths) {
    test(`GET ${path} sem sessão → redirect para /`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL("/");
    });
  }
});

test.describe("Security — portal cliente isolado", () => {
  test("/cliente/dashboard sem token → /cliente/login", async ({ page }) => {
    await page.goto("/cliente/dashboard");
    await expect(page).toHaveURL(/\/cliente\/login/);
  });
});

test.describe("Security — landing pública", () => {
  test("rota / acessível sem auth", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
    // Smoke: página carregou (não redirecionou para login)
    await expect(page.locator("body")).toBeVisible();
  });

  test("/login acessível sem auth", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });
});
