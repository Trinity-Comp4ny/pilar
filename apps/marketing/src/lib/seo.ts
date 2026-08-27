import { useEffect } from "react";

const BASE = "https://www.pilarsoft.com.br";

function setMeta(selector: string, valor: string) {
  document.head.querySelector(selector)?.setAttribute("content", valor);
}

/**
 * Meta tags por rota numa SPA: o index.html traz as da home, e cada página
 * sobrescreve title, description, canonical e OG ao montar. O Google renderiza
 * JS e lê estes valores; sem isso, toda rota aparecia na busca com o snippet
 * da home.
 */
export function usePageMeta({
  titulo,
  descricao,
  caminho,
  ogTitulo,
  ogDescricao,
}: {
  titulo: string;
  descricao: string;
  caminho: string;
  /** A home usa copy de compartilhamento diferente do title; as demais herdam. */
  ogTitulo?: string;
  ogDescricao?: string;
}) {
  useEffect(() => {
    const url = `${BASE}${caminho}`;
    document.title = titulo;
    setMeta('meta[name="description"]', descricao);
    setMeta('meta[property="og:title"]', ogTitulo ?? titulo);
    setMeta('meta[property="og:description"]', ogDescricao ?? descricao);
    setMeta('meta[property="og:url"]', url);
    setMeta('meta[name="twitter:title"]', ogTitulo ?? titulo);
    setMeta('meta[name="twitter:description"]', ogDescricao ?? descricao);
    document.head.querySelector('link[rel="canonical"]')?.setAttribute("href", url);
  }, [titulo, descricao, caminho, ogTitulo, ogDescricao]);
}

/**
 * Injeta um bloco JSON-LD enquanto a página está montada (ex.: FAQPage no
 * /faq). Remove ao desmontar pra não vazar pra outras rotas.
 */
export function useJsonLd(dados: object) {
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(dados);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
    // A página monta o objeto inline; serializar evita re-injetar por identidade nova.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dados)]);
}
