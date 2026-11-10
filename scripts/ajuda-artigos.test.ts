import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ARTIGOS, GRUPOS_AJUDA } from "../src/content/ajuda/indice";

/**
 * Central de ajuda (SPEC 154): o artigo só ajuda se o caminho que ele ensina existe. Esta régua
 * reprova o PR quando o índice e os arquivos divergem, quando um artigo aponta para rota que o
 * App não tem, ou quando o texto usa palavra banida da marca (brand/voice-tone.md).
 */
const PASTA = join(process.cwd(), "src/content/ajuda");
const APP = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
const ROTAS_DO_APP = new Set(
  [...APP.matchAll(/path="([^"]+)"/g)].map((m) => m[1]).filter((r) => r.startsWith("/") && !r.includes(":"))
);
const BANIDAS = [
  "solução completa",
  "revolucionar",
  "disruptivo",
  "sinergia",
  "robusto",
  "de ponta",
  "simplesmente",
  "incrível",
  "mágico",
];

const arquivos = readdirSync(PASTA).filter((f) => f.endsWith(".md"));

describe("central de ajuda", () => {
  it("todo artigo do índice tem arquivo e todo arquivo está no índice", () => {
    const slugs = ARTIGOS.map((a) => `${a.slug}.md`).sort();
    expect(slugs).toEqual([...arquivos].sort());
  });

  it("slugs únicos e grupos conhecidos", () => {
    expect(new Set(ARTIGOS.map((a) => a.slug)).size).toBe(ARTIGOS.length);
    const grupos = new Set(GRUPOS_AJUDA.map((g) => g.id));
    expect(ARTIGOS.filter((a) => !grupos.has(a.grupo)).map((a) => a.slug)).toEqual([]);
  });

  it("toda rota citada existe no App (índice e links do texto)", () => {
    const quebradas: string[] = [];
    for (const a of ARTIGOS) {
      for (const r of a.rotas) if (!ROTAS_DO_APP.has(r)) quebradas.push(`${a.slug}: ${r}`);
      const corpo = readFileSync(join(PASTA, `${a.slug}.md`), "utf8");
      for (const m of corpo.matchAll(/\]\((\/[^)#?\s]*)/g)) {
        const rota = m[1].replace(/\/+$/, "") || "/";
        const ehArtigo = rota.startsWith("/ajuda/") && ARTIGOS.some((x) => `/ajuda/${x.slug}` === rota);
        if (!ROTAS_DO_APP.has(rota) && !ehArtigo) quebradas.push(`${a.slug}: link ${rota}`);
      }
    }
    expect(quebradas).toEqual([]);
  });

  it("texto sem palavra banida da marca", () => {
    const achados = arquivos.flatMap((f) => {
      const corpo = readFileSync(join(PASTA, f), "utf8").toLowerCase();
      return BANIDAS.filter((b) => corpo.includes(b)).map((b) => `${f}: ${b}`);
    });
    expect(achados).toEqual([]);
  });
});
