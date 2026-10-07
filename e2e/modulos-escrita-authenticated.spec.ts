import { test, expect } from "./fixtures";

/**
 * Um fluxo de escrita por módulo ativo (plano de engenharia 2026-10, onda 2).
 *
 * Os specs de navegação provam que a tela abre; estes provam que dá para CRIAR
 * pelo caminho que o usuário usa (botão do header → diálogo → salvar) e que o
 * registro aparece na lista. Nome único por execução: rodam também em staging a
 * cada push, e nome fixo bateria na detecção de duplicata.
 *
 * Projeto e receita têm spec próprio (projeto-fluxo-*, financeiro-basico-*).
 */

const sufixo = () => Date.now().toString(36);

test.describe("Escrita por módulo", () => {
  test("cria cliente pessoa física e encontra na busca", async ({ page }) => {
    const nome = `E2E Cliente ${sufixo()}`;

    await page.goto("/clientes");
    await page
      .getByRole("button", { name: /Novo cliente/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog", { name: /Novo cliente/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Nome *" }).fill(nome);
    await dialog.getByRole("textbox", { name: "Email" }).fill(`e2e+${sufixo()}@pilar.test`);
    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder(/Buscar por nome/i).fill(nome);
    await expect(page.getByText(nome).first()).toBeVisible({ timeout: 10_000 });
  });

  test("cria lead e ele aparece no funil", async ({ page }) => {
    const nome = `E2E Lead ${sufixo()}`;

    await page.goto("/leads");
    await page
      .getByRole("button", { name: /Novo lead/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog", { name: /Novo lead/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("textbox", { name: "Nome *" }).fill(nome);
    await dialog.getByRole("textbox", { name: "Empresa" }).fill("Escritório E2E");
    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(nome).first()).toBeVisible({ timeout: 10_000 });
  });

  test("cria proposta sem vínculo e ela aparece na lista", async ({ page }) => {
    const titulo = `E2E Proposta ${sufixo()}`;

    await page.goto("/propostas");
    await page
      .getByRole("button", { name: /Nova proposta/i })
      .first()
      .click();

    const dialog = page.getByRole("dialog", { name: /Nova proposta/i });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Título *").fill(titulo);
    await dialog.getByRole("button", { name: "Criar proposta" }).click();

    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(titulo).first()).toBeVisible({ timeout: 10_000 });
  });
});
