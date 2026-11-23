import { describe, expect, it } from "vitest";
import { ARTIGOS_POR_SLUG } from "./blog";
import { COMPARATIVOS_POR_SLUG } from "./comparativos";
import { CTA_ARTIGOS, posicaoDoCta } from "./ctaArtigos";
import { analisarMarkdown } from "./markdown";
import { MODULOS_POR_SLUG } from "./modules";

const ROTAS_FIXAS = ["/ferramentas/calculadora-de-honorarios", "/engenharia", "/arquitetura"];

function rotaExiste(para: string): boolean {
  if (ROTAS_FIXAS.includes(para)) return true;
  const modulo = para.match(/^\/([a-z]+)$/)?.[1];
  if (modulo && modulo in MODULOS_POR_SLUG) return true;
  const comparativo = para.match(/^\/vs\/(.+)$/)?.[1];
  return Boolean(comparativo && comparativo in COMPARATIVOS_POR_SLUG);
}

describe("CTA contextual dos artigos", () => {
  it.each(Object.keys(CTA_ARTIGOS))("%s: o artigo existe e a ação leva a uma rota que existe", (slug) => {
    expect(ARTIGOS_POR_SLUG[slug], `artigo ${slug}`).toBeDefined();
    expect(rotaExiste(CTA_ARTIGOS[slug].acao.para), CTA_ARTIGOS[slug].acao.para).toBe(true);
  });

  it.each(Object.keys(CTA_ARTIGOS))("%s: tem ao menos três seções para o CTA entrar no meio", (slug) => {
    const blocos = analisarMarkdown(ARTIGOS_POR_SLUG[slug].corpo);
    expect(posicaoDoCta(blocos)).toBeGreaterThan(0);
  });

  it("entra antes da terceira seção e devolve -1 com menos de três", () => {
    const tres = analisarMarkdown("## A\n\ntexto\n\n## B\n\ntexto\n\n## C\n\ntexto");
    expect(tres[posicaoDoCta(tres)]).toMatchObject({ tipo: "h2", texto: "C" });
    expect(posicaoDoCta(analisarMarkdown("## A\n\ntexto\n\n## B\n\ntexto"))).toBe(-1);
  });
});
