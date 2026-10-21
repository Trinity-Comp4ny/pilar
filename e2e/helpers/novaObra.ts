import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Abre o formulário "Nova obra". Para quem tem a estimativa (SPEC 136, BEZ-24), o botão abre antes o
 * diálogo "Como quer começar a obra?"; o E2E segue pelo caminho em branco. Sem a estimativa, o
 * formulário abre direto, então o passo extra é opcional.
 */
export async function abrirNovaObra(page: Page): Promise<Locator> {
  await page
    .getByRole("button", { name: /Nova obra/i })
    .first()
    .click();
  const emBranco = page.getByRole("button", { name: /Começar em branco/i });
  const escolha = page.getByRole("dialog", { name: /Como quer começar a obra/i });
  if (await escolha.isVisible({ timeout: 3_000 }).catch(() => false)) await emBranco.click();
  const dialog = page.getByRole("dialog", { name: /Nova obra/i });
  await expect(dialog).toBeVisible();
  return dialog;
}
