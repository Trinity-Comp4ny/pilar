import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures";

/**
 * Acessibilidade das telas mais usadas do app logado (a landing tem o próprio spec,
 * marketing-a11y). Reprova violação critical ou serious do Axe, a mesma régua da
 * landing. Roda contra o banco local com o seed de demo, então as telas têm dado.
 */

const TELAS = [
  ["início", "/inicio"],
  ["quadro de projetos", "/projetos"],
  ["detalhe do projeto", "/projetos/00000000-0000-0000-0000-000000000401"],
  ["lançamentos", "/financeiro?tab=lancamentos&fp=tudo"],
  ["clientes", "/clientes"],
  ["leads", "/leads"],
  ["propostas", "/propostas"],
  ["obras", "/obras"],
  ["detalhe da obra", "/obras/00000000-0000-0000-0000-000000000a01"],
] as const;

test.use({ contextOptions: { reducedMotion: "reduce" } });

for (const [nome, rota] of TELAS) {
  test(`${nome} sem violação critical ou serious`, async ({ page }) => {
    test.skip(
      rota.includes("00000000-") && process.env.E2E_SEED_DEMO !== "1",
      "Depende do seed de demo (só no banco local)"
    );
    await page.goto(rota);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#main-content")).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).include("#main-content").analyze();
    const bloqueantes = violations
      .filter((v) => v.impact === "critical" || v.impact === "serious")
      .map((v) => `[${v.impact}] ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);

    expect(bloqueantes, bloqueantes.join("\n")).toEqual([]);
  });
}
