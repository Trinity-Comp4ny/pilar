/**
 * Busca e casamento por rota da central de ajuda (SPEC 154). O índice (`ARTIGOS`, em
 * src/content/ajuda/indice.ts) é leve e vai no bundle de entrada; o texto de cada artigo é
 * markdown carregado só quando a pessoa abre o artigo.
 */
import { ARTIGOS, type ArtigoAjuda } from "@/content/ajuda/indice";

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** A rota do artigo vale para ela mesma e para as telas abaixo (`/leads` cobre `/leads/123`). */
function casaRota(rota: string, pathname: string): boolean {
  const limpa = pathname.replace(/\/+$/, "") || "/";
  return limpa === rota || limpa.startsWith(`${rota}/`);
}

/** Artigos da tela aberta, do mais específico (rota mais longa) para o mais geral. */
export function artigosDaRota(pathname: string, artigos: readonly ArtigoAjuda[] = ARTIGOS): ArtigoAjuda[] {
  return artigos
    .map((a) => ({ a, peso: Math.max(-1, ...a.rotas.filter((r) => casaRota(r, pathname)).map((r) => r.length)) }))
    .filter((x) => x.peso >= 0)
    .sort((x, y) => y.peso - x.peso)
    .map((x) => x.a);
}

/** Busca por título, resumo e palavras-chave, sem acento. Título pesa mais. */
export function buscarArtigos(termo: string, artigos: readonly ArtigoAjuda[] = ARTIGOS): ArtigoAjuda[] {
  const palavras = normalizar(termo)
    .split(/\s+/)
    .filter((p) => p.length >= 2);
  if (palavras.length === 0) return [];
  return artigos
    .map((a) => {
      const titulo = normalizar(a.titulo);
      const resto = normalizar(`${a.resumo} ${a.palavras.join(" ")}`);
      let nota = 0;
      for (const p of palavras) {
        if (titulo.includes(p)) nota += 3;
        else if (resto.includes(p)) nota += 1;
        else return { a, nota: 0 };
      }
      return { a, nota };
    })
    .filter((x) => x.nota > 0)
    .sort((x, y) => y.nota - x.nota)
    .map((x) => x.a);
}

export function artigoPorSlug(slug: string | undefined): ArtigoAjuda | null {
  return ARTIGOS.find((a) => a.slug === slug) ?? null;
}

const CORPOS = import.meta.glob<string>("../content/ajuda/*.md", { query: "?raw", import: "default" });

/** Texto do artigo, baixado sob demanda. Sem arquivo, null. */
export async function carregarCorpo(slug: string): Promise<string | null> {
  const carregar = CORPOS[`../content/ajuda/${slug}.md`];
  return carregar ? carregar() : null;
}
