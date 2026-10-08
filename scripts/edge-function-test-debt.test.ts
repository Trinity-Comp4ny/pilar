import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Catraca de teste das Edge Functions.
 *
 * O `deno test` do CI só roda os testes que existem; função sem teste nenhum passa
 * verde em silêncio. `supabase/functions/TEST_DEBT.txt` lista as que ainda não têm
 * teste, e este arquivo garante que a lista só encolhe: função nova nasce com teste,
 * ou o PR reprova.
 */
const FUNCTIONS_DIR = resolve(process.cwd(), "supabase/functions");
const DEBT_PATH = resolve(FUNCTIONS_DIR, "TEST_DEBT.txt");

// Medido em 2026-10-07: 38 das 45 funções sem nenhum teste. Onda 2 (mesmo dia):
// as 6 de dinheiro e auth ganharam teste.
const MAX_DEBT = 31;

const debt = readFileSync(DEBT_PATH, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("#"));

const functionDirs = readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name);

const hasTest = (fn: string) =>
  readdirSync(resolve(FUNCTIONS_DIR, fn), { recursive: true })
    .map(String)
    .some((f) => f.endsWith(".test.ts"));

describe("dívida de teste das edge functions", () => {
  it(`não cresce além das ${MAX_DEBT} funções medidas na adoção`, () => {
    expect(debt.length).toBeLessThanOrEqual(MAX_DEBT);
  });

  it("função sem teste precisa estar na lista (função nova nasce com teste)", () => {
    const semTesteForaDaLista = functionDirs.filter((fn) => !hasTest(fn) && !debt.includes(fn));
    expect(
      semTesteForaDaLista,
      "Escreva um *.test.ts na pasta da função (padrão: invite-user/delivery.test.ts)"
    ).toEqual([]);
  });

  it("função que ganhou teste sai da lista (a catraca aperta)", () => {
    const comTesteNaLista = debt.filter((fn) => existsSync(resolve(FUNCTIONS_DIR, fn)) && hasTest(fn));
    expect(comTesteNaLista, "Remova estas linhas de supabase/functions/TEST_DEBT.txt").toEqual([]);
  });

  it("toda função listada existe (dívida de função deletada é ruído)", () => {
    for (const fn of debt) {
      expect(existsSync(resolve(FUNCTIONS_DIR, fn)), `${fn} não existe`).toBe(true);
    }
  });
});
