import { test, expect, type Locator, type Page } from "./fixtures";
import { loginComo } from "./helpers/loginComo";

/**
 * Aditivo: o usuário não cria, aprova. O aditivo nasce do guardião de margem ou do
 * chat e aparece na aba Escopo do projeto; aprovar soma o valor no contrato (trigger
 * handle_escopo_aprovado). É o fluxo de escrita que mexe em dinheiro do módulo
 * Projetos, então o teste confere o contrato antes e depois, não só o toast.
 *
 * Usa o aditivo pendente do seed de demo (projeto "Edifício Comercial Horizonte").
 * O e2e-local.sh devolve esse aditivo para pendente antes de cada rodada e exporta
 * E2E_SEED_DEMO=1. Sem o seed de demo (staging), o teste é pulado de saída. A decisão
 * vem do ambiente, nunca de "não achei a tela": assim, se o detalhe do projeto
 * quebrar, o teste falha em vez de virar "pulado".
 */

const PROJETO_DEMO = "/projetos/00000000-0000-0000-0000-000000000401";

/** "R$ 342.000,00" → 342000 */
const emReais = (texto: string) => {
  const m = /R\$\s?([\d.]+,\d{2})/.exec(texto);
  if (!m) throw new Error(`Sem valor em reais em: ${texto}`);
  return Number(m[1].replace(/\./g, "").replace(",", "."));
};

/** Valor do card "Contrato" do cabeçalho do projeto (campo de edição inline, pelo nome acessível). */
async function valorDoContrato(page: Page): Promise<number> {
  return emReais(await page.getByRole("textbox", { name: "Contrato" }).inputValue());
}

// O teste do usuário comum precisa do aditivo ainda pendente: roda antes da aprovação.
test.describe.configure({ mode: "serial" });

test("usuário sem acesso ao financeiro vê o aditivo sem valor e sem os botões de decisão", async ({ browser }) => {
  test.skip(process.env.E2E_SEED_DEMO !== "1", "Depende do seed de demo (só no banco local)");
  const page = await loginComo(browser, "user@local.test");
  await page.goto(PROJETO_DEMO);
  await page.getByRole("button", { name: "Escopo", exact: true }).click();

  await expect(page.getByText("A aprovação fica com quem tem acesso ao financeiro do escritório.").first()).toBeVisible(
    {
      timeout: 8_000,
    }
  );
  await expect(page.getByRole("button", { name: "Aprovar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Rejeitar", exact: true })).toHaveCount(0);
  await page.context().close();
});

test("aprovar aditivo soma o valor dele no contrato do projeto", async ({ page }) => {
  test.skip(process.env.E2E_SEED_DEMO !== "1", "Depende do seed de demo (só no banco local)");
  await page.goto(PROJETO_DEMO);
  await expect(page.getByText("Contrato", { exact: true })).toBeVisible({ timeout: 10_000 });
  const contratoAntes = await valorDoContrato(page);

  await page.getByRole("button", { name: "Escopo", exact: true }).click();

  const aprovar = page.getByRole("button", { name: "Aprovar", exact: true });
  await expect(aprovar.first()).toBeVisible({ timeout: 8_000 });

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
