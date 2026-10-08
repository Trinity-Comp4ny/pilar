import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Testa o site de marketing (apps/marketing, ADR 0021) direto em produção, não
// via webServer local: é um app Vite separado do resto do e2e (porta e comando
// de build diferentes), e testar a URL real garante que o teste reflete o que
// o visitante vê de fato, não um build local que pode divergir do deploy.
// Movimento reduzido: a frase da StatementSection acende palavra por palavra no
// scroll (opacidade 0,16 até a palavra passar), e com a preferência de movimento
// reduzido ela vem inteira. O Axe precisa medir esse estado final.
//
// Achado em 2026-10-08: este spec usava `reducedMotion: "reduce"` direto no
// test.use, opção que o Playwright ignora em silêncio. A emulação nunca ligou, o
// Axe media as palavras apagadas e o teste ficou vermelho por um mês com 29
// "violações" de contraste que não existem para o visitante. O jeito que funciona
// é contextOptions, e o primeiro expect do teste garante que a emulação está ativa.
test.use({ baseURL: "https://www.pilarsoft.com.br", contextOptions: { reducedMotion: "reduce" } });

test("landing de marketing não tem violação de acessibilidade critical ou serious", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  expect(
    await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
    "emulação de movimento reduzido não ligou: o Axe mediria a animação, não a página"
  ).toBe(true);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");

  if (blocking.length > 0) {
    const detail = blocking
      .map((v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} ocorrência(s))`)
      .join("\n");
    console.error(`Violações de acessibilidade bloqueantes:\n${detail}`);
  }

  expect(blocking, "violações critical/serious do Axe, ver console para detalhe").toEqual([]);
});
