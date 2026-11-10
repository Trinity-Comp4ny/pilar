import { describe, expect, it } from "vitest";
import { ARTIGOS, lerArtigo, relacionados } from "./blog";
import { ancora, analisarMarkdown, perguntasFrequentes } from "./markdown";

const FM = `---
titulo: Diário de obra
descricao: Uma descrição
palavraChave: diário de obra
categoria: Obra
modulo: campo
publicadoEm: 2026-11-10
resumo: Resumo curto
---
`;

describe("lerArtigo", () => {
  it("lê o frontmatter, completa os opcionais e estima a leitura", () => {
    const a = lerArtigo("rdo", `${FM}\nTexto ${"palavra ".repeat(400)}`);
    expect(a).toMatchObject({
      slug: "rdo",
      titulo: "Diário de obra",
      tituloSeo: "Diário de obra",
      atualizadoEm: "2026-11-10",
      autor: "Time Pilar",
      categoria: "Obra",
      modulo: "campo",
      minutosLeitura: 2,
    });
  });

  it("aceita dois-pontos dentro do valor", () => {
    const a = lerArtigo("x", FM.replace("titulo: Diário de obra", "titulo: RDO: o que registrar") + "\nCorpo");
    expect(a.titulo).toBe("RDO: o que registrar");
  });

  it("quebra o build com mensagem clara quando falta campo ou o valor é inválido", () => {
    expect(() => lerArtigo("x", "sem frontmatter")).toThrow(/frontmatter/);
    expect(() => lerArtigo("x", FM.replace("palavraChave: diário de obra\n", ""))).toThrow(/palavraChave/);
    expect(() => lerArtigo("x", FM.replace("categoria: Obra", "categoria: Marketing"))).toThrow(/categoria/);
    expect(() => lerArtigo("x", FM.replace("modulo: campo", "modulo: timesheet"))).toThrow(/módulo/);
  });
});

describe("artigos publicados", () => {
  it("todo artigo tem título curto para o Google, descrição na faixa e FAQ", () => {
    expect(ARTIGOS.length).toBeGreaterThan(0);
    for (const a of ARTIGOS) {
      expect(`${a.tituloSeo} | Pilar`.length, a.slug).toBeLessThanOrEqual(65);
      expect(a.descricao.length, a.slug).toBeGreaterThanOrEqual(110);
      expect(a.descricao.length, a.slug).toBeLessThanOrEqual(160);
      expect(perguntasFrequentes(analisarMarkdown(a.corpo)).length, a.slug).toBeGreaterThan(0);
    }
  });

  it("o corpo não usa H1 (o título já é o H1 da página)", () => {
    for (const a of ARTIGOS) expect(a.corpo, a.slug).not.toMatch(/^# /m);
  });

  it("link interno de artigo aponta para rota ou artigo que existe", () => {
    const slugs = new Set(ARTIGOS.map((a) => a.slug));
    const fixas = new Set(["/", "/gestao", "/projetos", "/obra", "/portal", "/campo", "/planos", "/faq", "/blog"]);
    for (const extra of ["/vs/planilha", "/vs/trello", "/engenharia", "/arquitetura"]) fixas.add(extra);
    for (const a of ARTIGOS) {
      for (const [, href] of a.corpo.matchAll(/\]\((\/[^)\s#]*)/g)) {
        const ok = fixas.has(href) || (href.startsWith("/blog/") && slugs.has(href.slice(6)));
        expect(ok, `${a.slug} → ${href}`).toBe(true);
      }
    }
  });

  it("relacionados não repete o próprio artigo", () => {
    const a = ARTIGOS[0];
    expect(relacionados(a).map((r) => r.slug)).not.toContain(a.slug);
  });
});

describe("analisarMarkdown", () => {
  it("separa títulos, parágrafos, listas, destaque e tabela", () => {
    const blocos = analisarMarkdown(
      [
        "## Como fazer?",
        "",
        "Linha um",
        "linha dois.",
        "",
        "- a",
        "- b",
        "",
        "1. primeiro",
        "2. segundo",
        "",
        "> atenção",
        "",
        "| Coluna | Valor |",
        "|---|---|",
        "| x | 1 |",
      ].join("\n")
    );
    expect(blocos).toEqual([
      { tipo: "h2", texto: "Como fazer?", id: "como-fazer" },
      { tipo: "p", texto: "Linha um linha dois." },
      { tipo: "ul", itens: ["a", "b"] },
      { tipo: "ol", itens: ["primeiro", "segundo"] },
      { tipo: "destaque", texto: "atenção" },
      { tipo: "tabela", cabecalho: ["Coluna", "Valor"], linhas: [["x", "1"]] },
    ]);
  });

  it("extrai o FAQ só da seção Perguntas frequentes, sem marcação", () => {
    const blocos = analisarMarkdown(
      "## Outra\n\n### Não é FAQ\n\nNada.\n\n## Perguntas frequentes\n\n### Precisa de app?\n\nNão, abre no **navegador** ([veja](/campo)).\n"
    );
    expect(perguntasFrequentes(blocos)).toEqual([
      { pergunta: "Precisa de app?", resposta: "Não, abre no navegador (veja)." },
    ]);
  });

  it("âncora sem acento nem pontuação", () => {
    expect(ancora("Quanto custa um RDO, afinal?")).toBe("quanto-custa-um-rdo-afinal");
  });
});
