import { test, expect } from "@playwright/test";

/**
 * Portal Cliente — smoke tests.
 *
 * Rota do portal: /cliente/login → /cliente/dashboard
 * Componente de login: ClienteLogin.tsx (usa placeholder "seu@email.com")
 *
 * Dois grupos:
 *  1. Público — rota de login carrega sem autenticação (roda no projeto "chromium")
 *  2. Autenticado — requer E2E_PORTAL_EMAIL e E2E_PORTAL_PASSWORD
 *
 * Como rodar localmente:
 *   export E2E_PORTAL_EMAIL=cliente@empresa.com
 *   export E2E_PORTAL_PASSWORD=SenhaPortal123!
 *   npx playwright test e2e/portal-cliente-autenticado.spec.ts
 */

test.describe("Portal Cliente — público (sem auth)", () => {
  test("página de login do portal carrega", async ({ page }) => {
    await page.goto("/cliente/login");

    // ClienteLogin.tsx usa placeholder "seu@email.com"
    await expect(page.getByPlaceholder("seu@email.com")).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole("button", { name: /Entrar/i })).toBeVisible();
  });

  test("dashboard do portal sem sessão redireciona para login", async ({ page }) => {
    await page.goto("/cliente/dashboard");
    await expect(page).toHaveURL(/\/cliente\/login/);
  });

  test("login com credenciais inválidas exibe erro", async ({ page }) => {
    await page.goto("/cliente/login");

    await page.fill('input[type="email"]', "invalido@exemplo.com");
    await page.fill('input[type="password"]', "SenhaErrada999!");
    await page.click('button[type="submit"]');

    // Toast de erro ou mensagem inline
    await expect(
      page.getByText(/Erro|inválido|credenciais|não encontrado/i).first()
    ).toBeVisible({ timeout: 8_000 });

    await expect(page).not.toHaveURL(/\/cliente\/dashboard/);
  });
});

test.describe("Portal Cliente — autenticado", () => {
  test("portal carrega lista de projetos do cliente", async ({ page }) => {
    test.skip(
      !process.env.E2E_PORTAL_EMAIL || !process.env.E2E_PORTAL_PASSWORD,
      "Credenciais de portal não definidas (E2E_PORTAL_EMAIL / E2E_PORTAL_PASSWORD)"
    );

    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(String(err)));

    await page.goto("/cliente/login");
    await page.fill('input[type="email"]', process.env.E2E_PORTAL_EMAIL!);
    await page.fill('input[type="password"]', process.env.E2E_PORTAL_PASSWORD!);
    await page.click('button[type="submit"]');

    // Aguarda redirect para o dashboard do cliente
    await page.waitForURL(/\/cliente\/dashboard/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/cliente\/dashboard/);

    // Página deve renderizar algo (projetos ou empty state — não deve crashar)
    await page.waitForLoadState("networkidle");
    await expect(page.locator("body")).toBeVisible();

    // Sem erros de JS críticos
    const critical = consoleErrors.filter(
      (e) => !/React Router Future Flag/i.test(e)
    );
    expect(critical).toHaveLength(0);
  });
});
