import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const RS = "\x1e";

function rodar(sha: string, entrada: string): string {
  return execFileSync("bash", ["scripts/release-notas.sh", sha], {
    input: entrada,
    env: { ...process.env, RELEASE_NOTAS_DRY_RUN: "1", RELEASE_NOTAS_URL: "", RELEASE_NOTAS_TOKEN: "" },
    encoding: "utf8",
  }).trim();
}

// SPEC 152: o script só junta os commits do release; quem lê as linhas é a edge release-rascunho.
describe("scripts/release-notas.sh", () => {
  it("manda só os commits com linha Novidade:, com o sha de cada um", () => {
    const entrada =
      `${RS}aaaaaaa1111\nfeat(faturas): x\n\nNovidade: Fatura no projeto\nImpacto: fluxo\n` +
      `${RS}bbbbbbb2222\nrefactor: y\n` +
      `${RS}ccccccc3333\nfix: z\n\nnovidade: Total não duplica\n`;
    const corpo = JSON.parse(rodar("abc1234", entrada));
    expect(corpo.sha).toBe("abc1234");
    expect(corpo.commits.map((c: { sha: string }) => c.sha)).toEqual(["aaaaaaa1111", "ccccccc3333"]);
    expect(corpo.commits[0].mensagem).toContain("Impacto: fluxo");
  });

  it("release sem novidade não manda nada", () => {
    expect(rodar("abc1234", `${RS}bbbbbbb2222\nchore: y\n`)).toContain("Nenhum commit com linha Novidade:");
  });

  it("recusa sha inválido", () => {
    expect(() => rodar("não-é-sha", "")).toThrow();
  });
});
