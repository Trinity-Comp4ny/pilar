import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * security.txt (RFC 9116) tem data de validade obrigatória. Arquivo vencido é pior que
 * nenhum: scanners e pesquisadores o tratam como abandonado. Este teste avisa 60 dias antes.
 */
const ARQUIVOS = ["public/.well-known/security.txt", "apps/marketing/public/.well-known/security.txt"];
const MARGEM_DIAS = 60;

describe.each(ARQUIVOS)("%s", (arquivo) => {
  const texto = readFileSync(arquivo, "utf8");

  it("tem Contact e Expires", () => {
    expect(texto).toMatch(/^Contact: mailto:\S+@\S+$/m);
    expect(texto).toMatch(/^Expires: \d{4}-\d{2}-\d{2}T/m);
  });

  it(`não vence nos próximos ${MARGEM_DIAS} dias (renove o Expires)`, () => {
    const expira = new Date(/^Expires: (\S+)$/m.exec(texto)![1]);
    const limite = new Date(Date.now() + MARGEM_DIAS * 24 * 60 * 60 * 1000);
    expect(expira.getTime()).toBeGreaterThan(limite.getTime());
  });
});
