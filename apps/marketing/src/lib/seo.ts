import { useEffect } from "react";

const BASE = "https://www.pilarsoft.com.br";

function setMeta(selector: string, valor: string) {
  document.head.querySelector(selector)?.setAttribute("content", valor);
}

const SUFIXO_MARCA = " | Pilar";
const LIMITE_TITULO = 60;

/**
 * O Google corta o título perto de 60 caracteres. Quando o " | Pilar" empurra
 * além disso, o sufixo sai e a palavra-chave fica inteira: a marca já aparece
 * no nome do site que o resultado mostra, e é a palavra-chave que ganha clique.
 */
export function tituloParaBusca(titulo: string) {
  if (titulo.length > LIMITE_TITULO && titulo.endsWith(SUFIXO_MARCA)) {
    return titulo.slice(0, -SUFIXO_MARCA.length);
  }
  return titulo;
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
  noindex = false,
}: {
  titulo: string;
  descricao: string;
  caminho: string;
  /** A home usa copy de compartilhamento diferente do title; as demais herdam. */
  ogTitulo?: string;
  ogDescricao?: string;
  /**
   * Página sem conteúdo indexável (ex.: 404). Não aponta canonical para a
   * própria URL inventada: fazer isso diz ao Google que aquela URL quebrada
   * é a versão canônica dela mesma, o sinal clássico de soft 404.
   */
  noindex?: boolean;
}) {
  useEffect(() => {
    const url = `${BASE}${caminho}`;
    document.title = tituloParaBusca(titulo);
    setMeta('meta[name="description"]', descricao);
    setMeta('meta[property="og:title"]', ogTitulo ?? titulo);
    setMeta('meta[property="og:description"]', ogDescricao ?? descricao);
    setMeta('meta[property="og:url"]', url);
    setMeta('meta[name="twitter:title"]', ogTitulo ?? titulo);
    setMeta('meta[name="twitter:description"]', ogDescricao ?? descricao);
    setMeta('meta[name="robots"]', noindex ? "noindex, follow" : "index, follow");
    if (!noindex) {
      document.head.querySelector('link[rel="canonical"]')?.setAttribute("href", url);
    }
  }, [titulo, descricao, caminho, ogTitulo, ogDescricao, noindex]);
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
