import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Varredura do texto que o visitante lê.
 *
 * Extrai do código só o que chega à tela (strings, templates e texto JSX), pela
 * AST do TypeScript: comentário e nome de variável não contam. Soma o
 * `index.html` (title, description, OG, JSON-LD) e o `llms.txt`.
 *
 * O que é proibido vem de decisão registrada:
 * - token: a cota de IA é vendida em créditos (DECISOES.md, 2026-11-06);
 * - teste grátis, trial, "14 dias": a entrada é só por demonstração (2026-10-19 e 2026-11-06);
 * - preço antigo (490/690/1.290): a tabela v3 foi superada em 2026-11-06;
 * - palavras banidas da voz da marca (`brand/voice-tone.md`).
 */

const SRC = dirname(fileURLToPath(import.meta.url));
const RAIZ_APP = join(SRC, "..");

function arquivosFonte(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return nome === "test" ? [] : arquivosFonte(caminho);
    if (!/\.tsx?$/.test(nome) || /\.test\.tsx?$/.test(nome) || nome.endsWith(".d.ts")) return [];
    return [caminho];
  });
}

/** Todo trecho de texto literal do arquivo: strings, templates e JSX. */
function textosDoArquivo(caminho: string): string[] {
  const fonte = ts.createSourceFile(caminho, readFileSync(caminho, "utf8"), ts.ScriptTarget.Latest, true);
  const textos: string[] = [];
  const visitar = (no: ts.Node) => {
    if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) textos.push(no.text);
    else if (ts.isTemplateHead(no) || ts.isTemplateMiddle(no) || ts.isTemplateTail(no)) textos.push(no.text);
    else if (ts.isJsxText(no) && no.text.trim()) textos.push(no.text.replace(/\s+/g, " ").trim());
    ts.forEachChild(no, visitar);
  };
  visitar(fonte);
  return textos;
}

interface Trecho {
  origem: string;
  texto: string;
}

function textoVisivel(): Trecho[] {
  const doCodigo = arquivosFonte(SRC).flatMap((caminho) =>
    textosDoArquivo(caminho).map((texto) => ({ origem: caminho.replace(`${RAIZ_APP}/`, ""), texto }))
  );
  // Comentário do HTML não é texto visível. Remove em laço até estabilizar: uma passada
  // só deixaria sobrar "<!--" de comentários aninhados ou quebrados.
  let html = readFileSync(join(RAIZ_APP, "index.html"), "utf8");
  for (let antes = ""; antes !== html;) {
    antes = html;
    html = html.replace(/<!--[\s\S]*?-->/g, "");
  }
  const llms = readFileSync(join(RAIZ_APP, "public/llms.txt"), "utf8");
  return [...doCodigo, { origem: "index.html", texto: html }, { origem: "public/llms.txt", texto: llms }];
}

const PROIBIDOS: { motivo: string; padrao: RegExp }[] = [
  { motivo: "IA é vendida em créditos, não em tokens", padrao: /\btokens?\b/i },
  { motivo: "entrada só por demonstração: sem teste grátis", padrao: /teste\s+gr[aá]tis/i },
  { motivo: "entrada só por demonstração: sem teste grátis", padrao: /gr[aá]tis/i },
  { motivo: "entrada só por demonstração: sem trial", padrao: /\btrial\b/i },
  { motivo: "entrada só por demonstração: sem período de teste", padrao: /per[ií]odo\s+de\s+teste/i },
  { motivo: "o trial de 14 dias acabou", padrao: /\b14\s+dias\b/i },
  { motivo: "cadastro aberto acabou (SPEC 133)", padrao: /crie\s+sua\s+conta|comece\s+agora|cadastre-se/i },
  { motivo: "preço antigo da tabela v3", padrao: /R\$\s*(490|690|1\.?290)\b/ },
  { motivo: "palavra banida da marca", padrao: /solu[cç][aã]o completa/i },
  { motivo: "palavra banida da marca", padrao: /revolucion/i },
  { motivo: "palavra banida da marca", padrao: /disruptiv/i },
  { motivo: "palavra banida da marca", padrao: /sinergia/i },
  { motivo: "palavra banida da marca", padrao: /\brobust[oa]s?\b/i },
  { motivo: "palavra banida da marca", padrao: /\bde ponta\b/i },
  { motivo: "palavra banida da marca", padrao: /incr[ií]vel/i },
  { motivo: "palavra banida da marca", padrao: /\bm[aá]gic[oa]s?\b/i },
  { motivo: "glossário: use 'do contrato à execução'", padrao: /ponta a ponta|end-to-end/i },
  { motivo: "glossário: a IA prepara, você aprova", padrao: /piloto autom[aá]tico|a IA decide/i },
];

describe("copy da landing", () => {
  const trechos = textoVisivel();

  it("a varredura enxerga o texto de verdade (senão passaria à toa)", () => {
    const tudo = trechos.map((t) => t.texto).join("\n");
    expect(trechos.length).toBeGreaterThan(500);
    expect(tudo).toContain("Agendar demonstração");
    expect(tudo).toContain("créditos de IA por mês");
    expect(tudo).toContain("Do contrato à execução");
  });

  it.each(PROIBIDOS.map((p) => [p.padrao.source, p] as const))("não usa /%s/", (_fonte, { motivo, padrao }) => {
    const achados = trechos.filter((t) => padrao.test(t.texto)).map((t) => `${t.origem}: "${t.texto.slice(0, 120)}"`);
    expect(achados, motivo).toEqual([]);
  });

  it("a tagline da marca aparece na home e no fecho", () => {
    const tudo = trechos.map((t) => t.texto).join("\n");
    expect(tudo).toMatch(/Do contrato à execução,? num fluxo só/);
    expect(tudo).toContain("A IA prepara");
  });
});
