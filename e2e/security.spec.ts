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
    // /templates saiu da lista: o módulo foi removido em 31/08 e a rota não
    // existe mais, então o anônimo cai no NotFound sem redirect. Testar rota
    // morta não prova guard nenhum.
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

test.describe("Security — a raiz do app não é landing pública", () => {
  // O app não tem landing própria (ADR 0021/0025): a raiz é um ExternalRedirect.
  // O destino depende do host, de propósito: em app.pilarsoft.com.br vai pro
  // marketing, e fora dele (este E2E roda em localhost) vai pro /login, pra não
  // jogar quem testa em staging no site de PRODUÇÃO. Ver appEnvironmentFromHost
  // e o unit test de marketingSite. Aqui o que se prova é que a raiz não
  // renderiza conteúdo de app: ela sempre sai de "/".
  test("rota / sem auth sai da raiz", async ({ page }) => {
    await page.route(/pilarsoft\.com\.br/, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>stub</body></html>" })
    );
    await page.goto("/");
    await expect(page).toHaveURL(/pilarsoft\.com\.br|\/login(\?|$)/);
  });

  test("/login acessível sem auth", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
  });
});
