import { test, expect } from "@playwright/test";
import { expectAnonRedirectedOut } from "./helpers/guards";

/**
 * Smoke tests de segurança, rodam sem auth fixture.
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
    "/templates",
    "/mapa",
    "/documentos",
  ];

  for (const path of protectedPaths) {
    test(`GET ${path} sem sessão → sai da rota`, async ({ page }) => {
      await expectAnonRedirectedOut(page, path);
    });
  }
});

test.describe("Security — portal cliente isolado", () => {
  test("/cliente/dashboard sem token → /cliente/login", async ({ page }) => {
    await page.goto("/cliente/dashboard");
    await expect(page).toHaveURL(/\/cliente\/login/);
  });
});

test.describe("Security — a raiz do app manda pro site de marketing", () => {
  // Não é mais "landing pública": o app não tem landing (ADR 0021/0025).
  test("rota / sem auth vai pro marketing, não pro login", async ({ page }) => {
    await page.route(/pilarsoft\.com\.br/, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>stub</body></html>" })
    );
    await page.goto("/");
    await expect(page).toHaveURL(/pilarsoft\.com\.br/);
  });

  test("/login acessível sem auth", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });
});
