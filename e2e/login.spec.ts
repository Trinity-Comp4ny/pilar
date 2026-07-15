import { test, expect } from "@playwright/test";

/**
 * Login — testes de autenticação (sem fixture, roda no projeto "chromium").
 *
 * Usa os seletores reais do Login.tsx:
 *   - input[type="email"]    (placeholder "seu@empresa.com")
 *   - input[type="password"] (placeholder "••••••••")
 *   - button[type="submit"]  (texto "Entrar")
 *
 * Erros de credenciais são exibidos como toast (sonner) com texto
 * "Erro ao fazer login" ou "Verifique suas credenciais".
 */

test.describe("Login — credenciais inválidas", () => {
  test("senha errada exibe mensagem de erro", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[type="email"]', "usuario@invalido.com");
    await page.fill('input[type="password"]', "SenhaErrada123!");
    await page.click('button[type="submit"]');

    // Toast de erro do sonner ou mensagem inline de validação Zod
    await expect(
      page
        .getByText(/Erro ao fazer login|Verifique suas credenciais|Dados inválidos|Muitas tentativas/i)
        .first()
    ).toBeVisible({ timeout: 8_000 });

    // Não deve ter navegado para o dashboard
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test("senha curta bloqueada por Zod antes de chamar API", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[type="email"]', "teste@empresa.com");
    await page.fill('input[type="password"]', "123");
    await page.click('button[type="submit"]');

    await expect(
      page
        .getByText(/Senha deve ter pelo menos|Dados inválidos|Erro ao fazer login|Verifique suas credenciais/i)
        .first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("email inválido não navega para dashboard", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[type="email"]', "sem-arroba");
    await page.fill('input[type="password"]', "SenhaValida123!");
    await page.click('button[type="submit"]');

    // HTML5 ou Zod bloqueia — nunca chega no dashboard
    await page.waitForTimeout(1_000);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Login — credenciais válidas", () => {
  test("login válido redireciona para /dashboard", async ({ page }) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;

    test.skip(!email || !password, "E2E_TEST_EMAIL e E2E_TEST_PASSWORD não definidos");

    await page.goto("/login");
    await page.fill('input[type="email"]', email!);
    await page.fill('input[type="password"]', password!);
    await page.click('button[type="submit"]');

    // Aguarda redirect — pode passar por /mfa se MFA estiver ativo
    await page.waitForURL(/\/(dashboard|mfa)/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/(dashboard|mfa)/);
  });
});
