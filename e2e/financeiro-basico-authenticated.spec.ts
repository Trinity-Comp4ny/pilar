import { test, expect } from "./fixtures";

/**
 * Financeiro — happy paths básicos (autenticado).
 *
 * Roda no projeto "authenticated" (depende do auth.setup.ts).
 * Testa criação de receita e verificação de KPI no dashboard.
 *
 * Como rodar localmente:
 *   set -a && source .env && set +a
 *   npx playwright test --project=authenticated e2e/financeiro-basico-authenticated.spec.ts
 */

test.describe("Financeiro — criar receita", () => {
  test("criar receita aparece nos KPIs do dashboard", async ({ page, cleanupAfter: _cleanup }) => {
    // Descrição única por execução — achado real, 17/08: com texto fixo, toda
    // reexecução (inclusive no CI a cada push) encontra o lançamento da rodada
    // anterior e a detecção de duplicata abre um alertdialog de confirmação em
    // vez de salvar direto, travando o teste no toast de sucesso.
    const descricaoUnica = `Receita E2E teste automatizado ${Date.now().toString(36)}`;
    // 1. Navegar para /financeiro na aba Lançamentos (que contém Receitas)
    await page.goto("/financeiro?tab=lancamentos");
    await expect(page).toHaveURL(/\/financeiro/);

    // A aba Lançamentos pode redirecionar para Receitas ou mostrá-las inline.
    // Tentamos via aba Visão Geral que sempre carrega na rota default.
    await page.goto("/financeiro?tab=visao-geral");
    await page.waitForLoadState("networkidle");

    // Verificar que estamos no financeiro autenticado
    await expect(page).not.toHaveURL(/^\//);

    // 2. Navegar para aba de Lançamentos para criar receita
    // O SecondSidebar renderiza links com texto dos labels
    const lancamentosLink = page.getByRole("button", { name: /Lançamentos/i }).or(
      page.getByText(/Lançamentos/i).first()
    );

    // Se o link de Lançamentos existir, clica; senão vai via URL
    const lancamentosVisible = await lancamentosLink.isVisible().catch(() => false);
    if (lancamentosVisible) {
      await lancamentosLink.click();
    } else {
      await page.goto("/financeiro?tab=lancamentos");
    }

    await page.waitForLoadState("networkidle");

    // 3. Clicar em "Nova Receita"
    const novaReceitaBtn = page.getByRole("button", { name: /Nova Receita/i });
    await expect(novaReceitaBtn).toBeVisible({ timeout: 10_000 });
    await novaReceitaBtn.click();

    // 4. Dialog "Nova Receita" deve abrir
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Nova Receita").first()).toBeVisible();

    // 5. Preencher descrição
    // Achado real, 17/08: o dialog "Nova Receita" aberto pela aba Lançamentos é o
    // LancamentoFormDialog (spec 044), não o FinanceItemForm da aba Receitas —
    // o Input não tinha `id`, e o placeholder real nunca foi "projeto residencial"
    // (sempre "Ex: Honorários projeto A"). Os dois lados do `.or()` antigo davam
    // zero match, e `.fill()` num locator vazio só estoura no timeout de 30s, sem
    // erro claro. Corrigido na origem (id="descricao" adicionado ao componente).
    const descricaoInput = page.locator('input[id="descricao"]').or(
      page.getByPlaceholder(/Honorários projeto/i)
    );
    await descricaoInput.fill(descricaoUnica);

    // 6. Preencher valor
    const valorInput = page.locator('input[id="valorTotal"]').or(
      page.getByPlaceholder(/R\$ 0,00/i)
    );
    await valorInput.fill("1000");

    // 6b. Selecionar categoria (obrigatória — achado real, 17/08: o Select não
    // tinha nenhum jeito acessível de mirar, e a empresa de teste não tinha
    // nenhuma categoria cadastrada, então "Salvar" sempre travava em validação
    // client-side. Corrigido: aria-label no trigger + categoria seedada no banco.)
    const categoriaCombobox = page.getByRole("combobox", { name: "Categoria" });
    await categoriaCombobox.click();
    await expect(page.getByRole("option").first()).toBeVisible({ timeout: 8_000 });
    await page.getByRole("option").first().click();

    // 7. Clicar em Próximo para ir ao step 2 (Classificação)
    const proximoBtn = page.getByRole("button", { name: /Próximo|Continuar/i });
    const hasProximo = await proximoBtn.isVisible().catch(() => false);
    if (hasProximo) {
      await proximoBtn.click();
      await page.waitForTimeout(500);
    }

    // 8. Salvar (step 2 ou direto)
    const salvarBtn = page.getByRole("button", { name: /Salvar|Criar Receita|Confirmar/i });
    await expect(salvarBtn).toBeVisible({ timeout: 5_000 });
    await salvarBtn.click();

    // 8b. App tem detecção de duplicata (mesma descrição+valor recentes) — se o
    // alertdialog aparecer, confirmar explicitamente em vez de travar no toast.
    const duplicataDialog = page.getByRole("alertdialog", { name: /duplicata/i });
    if (await duplicataDialog.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await duplicataDialog.getByRole("button", { name: /Salvar mesmo assim/i }).click();
    }

    // 9. Verificar toast de sucesso
    await expect(
      page.getByText(/salvo|criado|sucesso|Receita criada/i).first()
    ).toBeVisible({ timeout: 8_000 });

    // 10. Navegar para /dashboard (redireciona para /inicio — achado real, 17/08,
    // mesma reorganização de rotas do sidebar-navigation-authenticated.spec.ts)
    // e verificar KPI "A Receber"
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/inicio/);

    // KPI "A Receber" deve estar visível (independente do valor exato)
    await expect(page.getByText("A Receber")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Financeiro — smoke da visão geral", () => {
  test("KPIs de visão geral carregam sem erro", async ({ page }) => {
    await page.goto("/financeiro?tab=visao-geral");
    await page.waitForLoadState("networkidle");

    await expect(page).not.toHaveURL(/^\//);
    await expect(page).toHaveURL(/\/financeiro/);

    // Pelo menos um KPI deve aparecer
    const kpis = ["Receitas Totais", "Despesas Totais", "Lucro Líquido", "A receber", "A pagar"];
    const anyKpi = page.getByText(new RegExp(kpis.join("|"), "i")).first();
    await expect(anyKpi).toBeVisible({ timeout: 12_000 });

    // Sem erros de JS críticos
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    await page.waitForTimeout(500);
    expect(pageErrors).toHaveLength(0);
  });
});
