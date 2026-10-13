import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

/**
 * Acessibilidade das telas públicas do app: as primeiras que um cliente novo, um
 * cliente do portal ou alguém do campo vê, sem sessão. Mesma régua do spec logado
 * (a11y-app-authenticated): reprova violação critical ou serious do Axe.
 */

const TELAS = [
  ["login", "/login"],
  ["cadastro", "/cadastro"],
  ["recuperar senha", "/forgot-password"],
  ["login do portal do cliente", "/cliente/login"],
  ["login do Pilar Campo", "/campo/login"],
] as const;

test.use({ contextOptions: { reducedMotion: "reduce" } });

for (const [nome, rota] of TELAS) {
  test(`${nome} sem violação critical ou serious`, async ({ page }) => {
    await page.goto(rota);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("form").first()).toBeVisible();

    // O widget do captcha é iframe de terceiro: fora do escopo do que controlamos.
    const { violations } = await new AxeBuilder({ page }).exclude("iframe").analyze();
    const bloqueantes = violations
      .filter((v) => v.impact === "critical" || v.impact === "serious")
      .map((v) => `[${v.impact}] ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);

    expect(bloqueantes, bloqueantes.join("\n")).toEqual([]);
  });
}
