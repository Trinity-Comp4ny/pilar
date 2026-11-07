import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useJsonLd, usePageMeta } from "./seo";

/** O head do index.html, com as tags que o hook sobrescreve. */
function montarHead() {
  document.head.innerHTML = `
    <title>Home</title>
    <meta name="description" content="desc da home" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="https://www.pilarsoft.com.br/" />
    <meta property="og:title" content="og home" />
    <meta property="og:description" content="og desc home" />
    <meta property="og:url" content="https://www.pilarsoft.com.br/" />
    <meta name="twitter:title" content="tw home" />
    <meta name="twitter:description" content="tw desc home" />
  `;
}

const meta = (seletor: string) => document.head.querySelector(seletor)?.getAttribute("content");
const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute("href");

type MetaProps = Parameters<typeof usePageMeta>[0];

function Pagina(props: MetaProps) {
  usePageMeta(props);
  return null;
}

describe("usePageMeta", () => {
  beforeEach(montarHead);

  it("grava title, description, canonical, OG e Twitter da rota", () => {
    render(<Pagina titulo="Planos | Pilar" descricao="Preço por escritório." caminho="/planos" />);

    expect(document.title).toBe("Planos | Pilar");
    expect(meta('meta[name="description"]')).toBe("Preço por escritório.");
    expect(canonical()).toBe("https://www.pilarsoft.com.br/planos");
    expect(meta('meta[property="og:url"]')).toBe("https://www.pilarsoft.com.br/planos");
    expect(meta('meta[property="og:title"]')).toBe("Planos | Pilar");
    expect(meta('meta[property="og:description"]')).toBe("Preço por escritório.");
    expect(meta('meta[name="twitter:title"]')).toBe("Planos | Pilar");
    expect(meta('meta[name="twitter:description"]')).toBe("Preço por escritório.");
    expect(meta('meta[name="robots"]')).toBe("index, follow");
  });

  it("usa a copy de compartilhamento própria quando a página passa ogTitulo/ogDescricao", () => {
    render(<Pagina titulo="T" descricao="D" caminho="/" ogTitulo="OG T" ogDescricao="OG D" />);

    expect(document.title).toBe("T");
    expect(meta('meta[property="og:title"]')).toBe("OG T");
    expect(meta('meta[name="twitter:description"]')).toBe("OG D");
    expect(canonical()).toBe("https://www.pilarsoft.com.br/");
  });

  it("noindex não aponta canonical para a URL inventada (evita soft 404)", () => {
    render(<Pagina titulo="404" descricao="Não achamos." caminho="/rota-que-nao-existe" noindex />);

    expect(meta('meta[name="robots"]')).toBe("noindex, follow");
    expect(canonical()).toBe("https://www.pilarsoft.com.br/");
  });

  it("não quebra quando o head não tem as tags (spa.html enxuto)", () => {
    document.head.innerHTML = "";
    expect(() => render(<Pagina titulo="Sem head" descricao="x" caminho="/faq" />)).not.toThrow();
    expect(document.title).toBe("Sem head");
  });

  it("atualiza ao trocar de rota", () => {
    const { rerender } = render(<Pagina titulo="A" descricao="a" caminho="/gestao" />);
    rerender(<Pagina titulo="B" descricao="b" caminho="/obra" />);
    expect(document.title).toBe("B");
    expect(canonical()).toBe("https://www.pilarsoft.com.br/obra");
  });
});

function ComJsonLd({ dados }: { dados: object }) {
  useJsonLd(dados);
  return null;
}

describe("useJsonLd", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  const blocos = () => [...document.head.querySelectorAll('script[type="application/ld+json"]')];

  it("injeta o bloco enquanto a página está montada e remove ao desmontar", () => {
    const dados = { "@type": "FAQPage", mainEntity: [] };
    const { unmount } = render(<ComJsonLd dados={dados} />);

    expect(blocos()).toHaveLength(1);
    expect(JSON.parse(blocos()[0].textContent ?? "")).toEqual(dados);

    unmount();
    expect(blocos()).toHaveLength(0);
  });

  it("não reinjeta quando o objeto só muda de identidade", () => {
    const { rerender } = render(<ComJsonLd dados={{ a: 1 }} />);
    const primeiro = blocos()[0];
    rerender(<ComJsonLd dados={{ a: 1 }} />);
    expect(blocos()).toHaveLength(1);
    expect(blocos()[0]).toBe(primeiro);

    rerender(<ComJsonLd dados={{ a: 2 }} />);
    expect(blocos()).toHaveLength(1);
    expect(JSON.parse(blocos()[0].textContent ?? "")).toEqual({ a: 2 });
  });
});
