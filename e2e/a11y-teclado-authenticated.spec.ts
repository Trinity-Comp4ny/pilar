import { test, expect } from "./fixtures";

/**
 * Teclado de verdade, sem mouse: o que o Axe não mede (docs/design/ACESSIBILIDADE.md,
 * roteiro manual, seção 1). Cobre o skip link e o ciclo de foco de um modal: abre pelo
 * botão, prende o foco dentro, Esc fecha e o foco volta ao botão que abriu.
 *
 * Sem efeito colateral: abre e cancela o formulário, não salva nada. Roda em qualquer
 * ambiente, staging incluso.
 */

test("o primeiro Tab mostra o skip link e Enter leva o foco ao conteúdo principal", async ({ page }) => {
  await page.goto("/inicio");
  await expect(page.locator("#main-content")).toBeVisible();

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: /Pular para conteúdo principal/i });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  await page.keyboard.press("Enter");
  // O alvo do skip link recebe foco (ou o primeiro focável dentro dele), nunca fica no menu.
  const foco = await page.evaluate(() => {
    const main = document.querySelector("#main-content");
    const ativo = document.activeElement;
    return !!main && !!ativo && (main === ativo || main.contains(ativo));
  });
  expect(foco).toBe(true);
});

test("modal prende o foco, Esc fecha e o foco volta ao botão que abriu", async ({ page }) => {
  await page.goto("/gestao/clientes");
  const abrir = page.getByRole("button", { name: /Novo cliente/i }).first();
  await expect(abrir).toBeVisible();

  await abrir.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: /Novo cliente/i });
  await expect(dialog).toBeVisible();

  // Tab repetido nunca escapa do modal (foco preso).
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const dentro = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    expect(dentro, `Tab ${i + 1} saiu do modal`).toBe(true);
  }

  // Shift+Tab também não escapa.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Shift+Tab");
    const dentro = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
    expect(dentro, `Shift+Tab ${i + 1} saiu do modal`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(abrir).toBeFocused();
});
