import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * As duas allowlists de função SECURITY DEFINER chamável por anon andam juntas.
 *
 * `supabase/tests/anon_function_grants.sql` (pgTAP, banco montado das migrations,
 * roda em todo PR) e `scripts/audit-security.mjs` (banco real de staging e prod,
 * roda no cron de segunda) checam a mesma regra. Até aqui só um comentário pedia
 * para manter as duas em sincronia, e três vezes (24/08, 01/09, 13/10) a função
 * entrou no pgTAP e não no script: o PR passava e o cron reprovava dias depois,
 * já com a falha misturada a outras. Este teste quebra no próprio PR.
 */

const raiz = resolve(__dirname, "..");

function allowlistDoPgtap(): string[] {
  const sql = readFileSync(resolve(raiz, "supabase/tests/anon_function_grants.sql"), "utf8");
  const bloco = sql.slice(sql.indexOf("WITH allowed(sig)"), sql.indexOf("exposto AS"));
  return [...bloco.matchAll(/\('([a-z0-9_]+)\(/g)].map((m) => m[1]);
}

function allowlistDoScript(): string[] {
  const js = readFileSync(resolve(raiz, "scripts/audit-security.mjs"), "utf8");
  const inicio = js.indexOf("const ANON_ESPERADO = new Set([");
  const bloco = js.slice(inicio, js.indexOf("]);", inicio));
  return [...bloco.matchAll(/^\s*"([a-z0-9_]+)",/gm)].map((m) => m[1]);
}

describe("allowlist de funções chamáveis por anon", () => {
  it("lê as duas listas (o parser não quebrou em silêncio)", () => {
    expect(allowlistDoPgtap().length).toBeGreaterThan(20);
    expect(allowlistDoScript().length).toBeGreaterThan(20);
  });

  it("pgTAP e audit-security.mjs listam as mesmas funções", () => {
    const pgtap = [...new Set(allowlistDoPgtap())].sort();
    const script = [...new Set(allowlistDoScript())].sort();
    expect(script).toEqual(pgtap);
  });
});
