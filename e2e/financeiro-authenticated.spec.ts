import { test, expect } from "./fixtures";

/**
 * Financeiro — smoke autenticado.
 *
 * Roda no projeto "authenticated", que injeta storageState gerado pelo
 * auth.setup.ts. Sem credenciais o setup falha e este spec não executa.
 *
 * Como rodar localmente:
 *   set -a && source .env && set +a
 *   export E2E_TEST_EMAIL=admin-e2e@pilar.test
 *   export E2E_TEST_PASSWORD=...
 *   npx playwright test --project=authenticated e2e/financeiro-authenticated.spec.ts
 *
 * NÃO cria/edita dados — apenas valida que a rota carrega autenticada e que
 * pelo menos um KPI da Visão Geral aparece.
 */

test.describe("Financeiro autenticado — smoke", () => {
  test("admin acessa /financeiro e vê KPI da visão geral", async ({ page }) => {
    await page.goto("/financeiro");

    // Não deve cair de volta na landing.
    await expect(page).not.toHaveURL(/^\/$/);
    await expect(page).toHaveURL(/\/financeiro/);

    // Pelo menos um KPI da Visão Geral aparece. Os títulos vêm de
    // src/pages/financeiro/tabs/VisaoGeral.tsx (CardTitle).
    const kpis = ["Receitas Totais", "Despesas Totais", "Lucro Líquido", "A receber", "A pagar"];

    const anyKpi = page.getByText(new RegExp(kpis.join("|"), "i")).first();
    await expect(anyKpi).toBeVisible({ timeout: 10_000 });
  });
});
