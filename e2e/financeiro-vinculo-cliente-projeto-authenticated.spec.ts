import { test, expect } from "./fixtures";

/**
 * Lançamento de receita: cliente e projeto andam juntos (feedback da VRZ, 14/10).
 * O projeto pertence a um cliente (`projetos.cliente_id`); escolher o projeto preenche o
 * cliente, e escolher o cliente só oferece os projetos dele. Abre e cancela o formulário,
 * não salva nada. Depende do seed de demo (só no banco local).
 */

const CLIENTE_HORIZONTE = "Construtora Horizonte";
const PROJETO_HORIZONTE = "Edifício Comercial Horizonte";
const CLIENTE_VALE_VERDE = "Incorporadora Vale Verde";
const PROJETO_VALE_VERDE = "Residencial Vale Verde";

async function abrirNovaReceita(page: import("@playwright/test").Page) {
  await page.goto("/financeiro?tab=lancamentos&fp=tudo");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("button", { name: /Novo lançamento/i })
    .first()
    .click();
  await page
    .getByRole("dialog", { name: /Novo lançamento/i })
    .getByRole("button", { name: /Receita/i })
    .click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Nova Receita" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("Receita: vínculo entre cliente e projeto", () => {
  test.skip(process.env.E2E_SEED_DEMO !== "1", "Depende do seed de demo (só no banco local)");

  test("escolher o projeto preenche o cliente", async ({ page }) => {
    const dialog = await abrirNovaReceita(page);

    await dialog.getByRole("combobox", { name: "Projeto" }).click();
    await page.getByRole("option", { name: PROJETO_HORIZONTE }).click();

    await expect(dialog.getByRole("combobox", { name: "Cliente (pagante)" })).toHaveText(CLIENTE_HORIZONTE);
  });

  test("escolher o cliente oferece só os projetos dele", async ({ page }) => {
    const dialog = await abrirNovaReceita(page);

    await dialog.getByRole("combobox", { name: "Cliente (pagante)" }).click();
    await page.getByRole("option", { name: CLIENTE_VALE_VERDE }).click();

    await dialog.getByRole("combobox", { name: "Projeto" }).click();
    await expect(page.getByRole("option", { name: PROJETO_VALE_VERDE })).toBeVisible();
    await expect(page.getByRole("option", { name: PROJETO_HORIZONTE })).toHaveCount(0);
  });

  test("trocar para um cliente de outro projeto limpa o projeto", async ({ page }) => {
    const dialog = await abrirNovaReceita(page);

    await dialog.getByRole("combobox", { name: "Projeto" }).click();
    await page.getByRole("option", { name: PROJETO_HORIZONTE }).click();
    await expect(dialog.getByRole("combobox", { name: "Projeto" })).toHaveText(PROJETO_HORIZONTE);

    await dialog.getByRole("combobox", { name: "Cliente (pagante)" }).click();
    await page.getByRole("option", { name: CLIENTE_VALE_VERDE }).click();

    await expect(dialog.getByRole("combobox", { name: "Projeto" })).not.toHaveText(PROJETO_HORIZONTE);
  });
});
