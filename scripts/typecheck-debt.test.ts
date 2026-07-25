import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * O ratchet da dívida de tipos das Edge Functions.
 *
 * `supabase/functions/TYPECHECK_DEBT.txt` lista as funções que ainda não passam no
 * `deno check`. A regra é que a lista só encolhe: sem este teste, "adicionar uma
 * linha" seria a saída fácil na primeira vez que alguém quebrasse o gate, e o gate
 * viraria decoração.
 */
const DEBT_PATH = "supabase/functions/TYPECHECK_DEBT.txt";

// Medido no run 30174544332 (2026-07-25): 12 erros de tipo em 5 funções.
const MAX_DEBT = 5;

const entries = readFileSync(resolve(process.cwd(), DEBT_PATH), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("#"));

describe("dívida de typecheck das edge functions", () => {
  it(`não cresce além das ${MAX_DEBT} funções medidas na adoção`, () => {
    expect(entries.length).toBeLessThanOrEqual(MAX_DEBT);
  });

  it("todo path listado existe (dívida de função deletada é ruído)", () => {
    for (const entry of entries) {
      expect(existsSync(resolve(process.cwd(), entry)), `${entry} não existe`).toBe(true);
    }
  });

  it("não tem path duplicado", () => {
    expect(new Set(entries).size).toBe(entries.length);
  });

  it("lista só index.ts de edge function", () => {
    for (const entry of entries) {
      expect(entry).toMatch(/^supabase\/functions\/[a-z0-9_-]+\/index\.ts$/);
    }
  });
});
