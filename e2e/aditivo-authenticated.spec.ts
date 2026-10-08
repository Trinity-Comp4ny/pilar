import { test, expect, type Locator, type Page } from "./fixtures";

/**
 * Aditivo: o usuário não cria, aprova. O aditivo nasce do guardião de margem ou do
 * chat e aparece na aba Escopo do projeto; aprovar soma o valor no contrato (trigger
 * handle_escopo_aprovado). É o fluxo de escrita que mexe em dinheiro do módulo
 * Projetos, então o teste confere o contrato antes e depois, não só o toast.
 *
 * Usa o aditivo pendente do seed de demo (projeto "Edifício Comercial Horizonte").
 * O e2e-local.sh devolve esse aditivo para pendente antes de cada rodada. Onde não
 * houver aditivo pendente (staging), o teste é pulado.
 */

const PROJETO_DEMO = "/projetos/00000000-0000-0000-0000-000000000401";

/** "R$ 342.000,00" → 342000 */
const emReais = (texto: string) => {
  const m = /R\$\s?([\d.]+,\d{2})/.exec(texto);
  if (!m) throw new Error(`Sem valor em reais em: ${texto}`);
  return Number(m[1].replace(/\./g, "").replace(",", "."));
};

/** Valor do card "Contrato" do cabeçalho do projeto (campo de edição inline). */
async function valorDoContrato(page: Page): Promise<number> {
  const campo = page.getByText("Contrato", { exact: true }).locator("xpath=..").getByRole("textbox");
  return emReais(await campo.inputValue());
}

test("aprovar aditivo soma o valor dele no contrato do projeto", async ({ page }) => {
  await page.goto(PROJETO_DEMO);
  await expect(page.getByText("Contrato", { exact: true })).toBeVisible({ timeout: 10_000 });
  const contratoAntes = await valorDoContrato(page);

  await page.getByRole("button", { name: "Escopo", exact: true }).click();

  const aprovar = page.getByRole("button", { name: "Aprovar", exact: true });
  const temPendente = await aprovar
    .first()
    .waitFor({ timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!temPendente, "Nenhum aditivo pendente neste ambiente");

  // Menor div que tem o botão e um valor em reais = o card do aditivo.
  const card: Locator = page.locator("div").filter({ has: aprovar.first() }).filter({ hasText: /R\$/ }).last();
  const valorAditivo = emReais((await card.textContent()) ?? "");
  expect(valorAditivo).toBeGreaterThan(0);

  await aprovar.first().click();
  const confirmar = page.getByRole("alertdialog", { name: /Aprovar aditivo/i });
  await expect(confirmar).toBeVisible();
  await confirmar.getByRole("button", { name: "Aprovar", exact: true }).click();

  await expect(page.getByText(/Aditivo aprovado/i).first()).toBeVisible({ timeout: 10_000 });
  await expect(async () => {
    expect(await valorDoContrato(page)).toBeCloseTo(contratoAntes + valorAditivo, 2);
  }).toPass({ timeout: 10_000 });
});
