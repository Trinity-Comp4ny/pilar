import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ONBOARDING_STEPS } from "./steps";

/**
 * O tour guiado aponta para `[data-tour=...]`. Se alguém renomear ou tirar o
 * elemento da tela, o passo perde o destaque sem ninguém ver. Este teste reprova
 * quando o alvo declarado em `steps.ts` não existe mais no código das telas.
 */
function arquivosFonte(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosFonte(caminho, acc);
    else if (/\.tsx$/.test(nome) && !/\.test\./.test(nome)) acc.push(caminho);
  }
  return acc;
}

describe("alvos do tour de onboarding", () => {
  const fontes = arquivosFonte(join(process.cwd(), "src")).map((f) => readFileSync(f, "utf8"));

  it.each(ONBOARDING_STEPS.filter((s) => s.tour).map((s) => [s.key, s.tour!.selector] as const))(
    "passo %s: alvo %s existe em alguma tela",
    (_key, selector) => {
      expect(fontes.some((src) => src.includes(`"${selector}"`))).toBe(true);
    }
  );
});
