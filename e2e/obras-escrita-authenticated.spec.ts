import { test, expect } from "./fixtures";

/**
 * Obras: o caminho de escrita que o engenheiro usa no dia a dia (frente prioritária,
 * decisão de 25/08). Cria a obra, registra o dia no diário e lança uma despesa na
 * conta da obra, conferindo que cada registro aparece onde o usuário vai procurar.
 *
 * Tudo numa obra nova, com nome único por execução: o diário tem um registro por obra
 * por dia, e reaproveitar a obra do seed bateria nessa trava na segunda rodada.
 */

test.describe.configure({ mode: "serial" });

const nome = `E2E Obra ${Date.now().toString(36)}`;

test("cria obra e ela aparece na lista", async ({ page }) => {
  await page.goto("/obras");
  await page
    .getByRole("button", { name: /Nova obra/i })
    .first()
    .click();

  const dialog = page.getByRole("dialog", { name: /Nova obra/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Nome da obra *").fill(nome);
  await dialog.getByRole("button", { name: "Criar obra" }).click();

  await expect(page.getByText("Obra criada").first()).toBeVisible({ timeout: 10_000 });
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(nome).first()).toBeVisible({ timeout: 10_000 });
});

test("registra o dia no diário da obra", async ({ page }) => {
  await page.goto("/obras");
  await page.getByText(nome).first().click();
  await expect(page.getByRole("heading", { name: nome }).first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole("tab", { name: "Diário" }).click();
  await page.getByRole("button", { name: "Registrar dia" }).first().click();

  const dialog = page.getByRole("dialog", { name: "Registrar dia" });
  await expect(dialog).toBeVisible();
  // O diário abre na gravação por áudio; o formulário é o caminho manual.
  await dialog.getByRole("button", { name: "Prefiro preencher manualmente" }).click();
  await dialog.getByLabel("Total de pessoas na obra").fill("7");
  await dialog.getByLabel("Observações do dia").fill("Concretagem da laje do térreo");
  await dialog.getByRole("button", { name: "Salvar" }).click();

  await expect(page.getByText("Dia registrado").first()).toBeVisible({ timeout: 10_000 });
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Concretagem da laje do térreo").first()).toBeVisible({ timeout: 10_000 });
});

test("lança despesa na conta da obra", async ({ page }) => {
  await page.goto("/obras");
  await page.getByText(nome).first().click();
  await expect(page.getByRole("heading", { name: nome }).first()).toBeVisible({ timeout: 10_000 });

  await page.getByRole("tab", { name: "Conta da obra" }).click();
  await page.getByRole("button", { name: "Despesa", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Nova despesa" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Valor (R$)").fill("1250");
  await dialog.getByLabel("Descrição").fill("Cimento CP-II 50 sacos");
  await dialog.getByRole("button", { name: "Registrar" }).click();

  await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Cimento CP-II 50 sacos").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/R\$\s?1\.250,00/).first()).toBeVisible();
});
