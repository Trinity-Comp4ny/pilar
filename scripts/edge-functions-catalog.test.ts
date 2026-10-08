import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DOMINIOS, gerarCatalogo } from "./edge-functions-catalog.mjs";

/**
 * O catálogo das Edge Functions (docs/architecture/EDGE_FUNCTIONS.md) é gerado. Sem
 * este teste ele envelhece em silêncio: função nova sem descrição, chamador que sumiu,
 * secret novo. Se reprovar: edite supabase/functions/CATALOGO.json e rode
 * `node scripts/edge-functions-catalog.mjs`.
 */
const raiz = process.cwd();
const manifesto = JSON.parse(readFileSync(resolve(raiz, "supabase/functions/CATALOGO.json"), "utf8")) as Record<
  string,
  { dominio: string; descricao: string; chamada_externa?: string }
>;
const funcoes = readdirSync(resolve(raiz, "supabase/functions"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name);

describe("catálogo das Edge Functions", () => {
  it("toda função está no CATALOGO.json (função nova nasce descrita)", () => {
    expect(funcoes.filter((f) => !manifesto[f])).toEqual([]);
  });

  it("o CATALOGO.json não descreve função que não existe mais", () => {
    expect(Object.keys(manifesto).filter((f) => !funcoes.includes(f))).toEqual([]);
  });

  it("todo domínio é conhecido e toda descrição é uma frase", () => {
    for (const [nome, m] of Object.entries(manifesto)) {
      expect(Object.keys(DOMINIOS), nome).toContain(m.dominio);
      expect(m.descricao.length, nome).toBeGreaterThan(10);
    }
  });

  it("o arquivo commitado é exatamente o que o gerador produz", () => {
    const commitado = readFileSync(resolve(raiz, "docs/architecture/EDGE_FUNCTIONS.md"), "utf8");
    expect(commitado, "Rode `node scripts/edge-functions-catalog.mjs` e commite").toBe(gerarCatalogo(raiz));
  });
});
