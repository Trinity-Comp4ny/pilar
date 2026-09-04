import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Testa o site de marketing (apps/marketing, ADR 0021) direto em produção, não
// via webServer local: é um app Vite separado do resto do e2e (porta e comando
// de build diferentes), e testar a URL real garante que o teste reflete o que
// o visitante vê de fato, não um build local que pode divergir do deploy.
// reducedMotion: a landing entra com fade palavra por palavra (motion system da
// spec 060). Sem isto o Axe fotografa a página no meio da animação e mede o
// contraste de um estado transitório: numa medição real deu 89 violações contra
// 9 de verdade, 29 delas só palavras paradas em `opacity: 0.16`. O estado que
// interessa ao visitante é o final, e é ele que precisa passar em AA.
test.use({ baseURL: "https://www.pilarsoft.com.br", reducedMotion: "reduce" });

test("landing de marketing não tem violação de acessibilidade critical ou serious", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
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
