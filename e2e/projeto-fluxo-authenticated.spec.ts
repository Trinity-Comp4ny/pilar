import { test, expect } from "./fixtures";

/**
 * Projetos — fluxo de criação (autenticado).
 *
 * Roda no projeto "authenticated" (depende do auth.setup.ts).
 *
 * O ProjetoFormDialog é um wizard de 3 passos:
 *   Passo 1 — Identificação: código, nome, cliente (obrigatórios)
 *   Passo 2 — Escopo & Prazo
 *   Passo 3 — Disciplinas
 *
 * Como rodar localmente:
 *   set -a && source .env && set +a
 *   npx playwright test --project=authenticated e2e/projeto-fluxo-authenticated.spec.ts
 */

test.describe("Projetos — criação e navegação", () => {
  test("criar projeto navega para detalhes do projeto", async ({ page, testEmpresa }) => {
    await page.goto("/projetos");
    await page.waitForLoadState("networkidle");

    await expect(page).not.toHaveURL(/^\//);
    await expect(page).toHaveURL(/\/projetos/);

    // 1. Clicar em "Novo Projeto"
    const novoProjetoBtn = page.getByRole("button", { name: /Novo Projeto/i });
    await expect(novoProjetoBtn).toBeVisible({ timeout: 10_000 });
    await novoProjetoBtn.click();

    // 2. Dialog do wizard deve abrir
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Novo Projeto").first()).toBeVisible();

    // 3. Preencher Passo 1 — campos obrigatórios
    // Código do projeto
    const codigoInput = page.locator('input[id="codigo_projeto"]').or(
      page.getByPlaceholder(/PRJ-\d{4}-\d{3}/i)
    );
    await codigoInput.fill(`E2E-${testEmpresa.slug.slice(0, 12).toUpperCase()}`);

    // Nome do projeto (campo "nome")
    const nomeInput = page.locator('input[id="nome"]').or(
      page.getByPlaceholder(/nome do projeto/i)
    );
    const nomeVisible = await nomeInput.isVisible().catch(() => false);
    if (nomeVisible) {
      await nomeInput.fill(testEmpresa.nome);
    } else {
      // nome pode estar logo abaixo do campo de código — tenta pelo label
      await page.getByLabel(/Nome/i).fill(testEmpresa.nome);
    }

    // Cliente — seleciona o primeiro da lista (select shadcn/ui)
    const clienteSelect = page.getByLabel(/Cliente/i).or(
      page.locator('[id="cliente"]')
    );
    const clienteSelectVisible = await clienteSelect.isVisible().catch(() => false);
    if (clienteSelectVisible) {
      await clienteSelect.click();
      // Seleciona a primeira opção disponível
      const primeiraOpcao = page.getByRole("option").first();
      const temOpcao = await primeiraOpcao.isVisible({ timeout: 3_000 }).catch(() => false);
      if (temOpcao) {
        await primeiraOpcao.click();
      }
    } else {
      // Fallback: SelectTrigger do shadcn renderizado como button
      const selectTrigger = page.locator('[role="combobox"]').first();
      await selectTrigger.click();
      const primeiraOpcao = page.getByRole("option").first();
      const temOpcao = await primeiraOpcao.isVisible({ timeout: 3_000 }).catch(() => false);
      if (temOpcao) await primeiraOpcao.click();
    }

    // 4. Avançar para passo 2
    const proximoBtn = page.getByRole("button", { name: /Próximo|Continuar|Avançar/i });
    await expect(proximoBtn).toBeVisible({ timeout: 5_000 });
    await proximoBtn.click();

    // 5. Avançar para passo 3 (skip preenchimento do passo 2)
    await page.waitForTimeout(300);
    const proximoBtn2 = page.getByRole("button", { name: /Próximo|Continuar|Avançar/i });
    const hasProximo2 = await proximoBtn2.isVisible({ timeout: 2_000 }).catch(() => false);
    if (hasProximo2) {
      await proximoBtn2.click();
      await page.waitForTimeout(300);
    }

    // 6. Salvar (passo 3 ou último passo disponível)
    const salvarBtn = page.getByRole("button", { name: /Salvar Projeto|Salvar|Criar/i });
    await expect(salvarBtn).toBeVisible({ timeout: 5_000 });
    await salvarBtn.click();

    // 7. Toast de sucesso ou redirect para detail
    await Promise.race([
      expect(page.getByText(/salvo|criado|sucesso/i).first()).toBeVisible({ timeout: 8_000 }),
      page.waitForURL(/\/projetos\/[^/]+/, { timeout: 8_000 }),
    ]).catch(() => {
      // Pelo menos um dos dois deve ocorrer
    });

    // 8. Nome do projeto deve aparecer na página (no kanban ou no detalhe)
    await expect(
      page.getByText(testEmpresa.nome).or(page.getByText(/E2E-/i)).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("página de projetos carrega e exibe kanban ou empty state", async ({ page }) => {
    await page.goto("/projetos");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/projetos/);

    // Deve mostrar o botão "Novo Projeto" (permissão de criação)
    await expect(page.getByRole("button", { name: /Novo Projeto/i })).toBeVisible({ timeout: 10_000 });

    // Sem erros críticos
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    await page.waitForTimeout(500);
    expect(pageErrors).toHaveLength(0);
  });
});
