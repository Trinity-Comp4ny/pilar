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
  test("criar receita aparece na lista de lançamentos", async ({ page, cleanupAfter: _cleanup }) => {
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
    const lancamentosLink = page
      .getByRole("button", { name: /Lançamentos/i })
      .or(page.getByText(/Lançamentos/i).first());

    // Se o link de Lançamentos existir, clica; senão vai via URL
    const lancamentosVisible = await lancamentosLink.isVisible().catch(() => false);
    if (lancamentosVisible) {
      await lancamentosLink.click();
    } else {
      await page.goto("/financeiro?tab=lancamentos");
    }

    await page.waitForLoadState("networkidle");

    // 3. "Novo lançamento" do header abre o seletor de tipo, e "Receita" abre o
    // formulário. Achado real, 07/10: o botão "Nova Receita" deixou de existir
    // quando o header ganhou o seletor (NovoLancamentoDialog), e ninguém viu
    // porque este spec ficou um mês sem rodar no CI (o passo autenticado era
    // pulado sempre que o spec de a11y da landing falhava antes dele).
    const novoLancamentoBtn = page.getByRole("button", { name: /Novo lançamento/i }).first();
    await expect(novoLancamentoBtn).toBeVisible({ timeout: 10_000 });
    await novoLancamentoBtn.click();
    const seletorTipo = page.getByRole("dialog", { name: /Novo lançamento/i });
    await expect(seletorTipo).toBeVisible({ timeout: 5_000 });
    await seletorTipo.getByRole("button", { name: /Receita/i }).click();

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
    const descricaoInput = page.locator('input[id="descricao"]').or(page.getByPlaceholder(/Honorários projeto/i));
    await descricaoInput.fill(descricaoUnica);

    // 6. Preencher valor
    const valorInput = page.locator('input[id="valorTotal"]').or(page.getByPlaceholder(/R\$ 0,00/i));
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
    await expect(page.getByText(/salvo|criado|sucesso|Receita criada/i).first()).toBeVisible({ timeout: 8_000 });

    // 10. A receita entra na lista de lançamentos e o KPI "A receber" segue na
    // tela. Antes isto ia para /inicio procurar o KPI, mas desde a spec 092 o
    // painel de /inicio é montado pelo usuário e financeiro não entra no padrão
    // (ADR 0038): a asserção passou a medir a configuração do painel, não o lançamento.
    await expect(page.getByText(descricaoUnica).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/A receber/i).first()).toBeVisible();
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
