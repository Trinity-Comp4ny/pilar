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

// Palavras da pergunta que não dizem o assunto ("como eu faço para...").
const VAZIAS = new Set(
  "como eu faco fazer onde que qual quais para pra por um uma uns umas o a os as de do da dos das no na nos nas em e ou meu minha meus minhas seu sua posso consigo quero preciso tem ter vou ir ver se isso esse essa aqui ai la sobre com sem ja nao sim".split(
    " "
  )
);

/** Raiz curta da palavra: "crio" e "criar" casam, "propostas" e "proposta" também. */
function raiz(palavra: string): string {
  return palavra.length <= 4 ? palavra.slice(0, 3) : palavra.slice(0, palavra.length - 2);
}

/** Fração mínima das palavras da pergunta que precisa aparecer no artigo. */
const MINIMO_CASADO = 0.6;

/**
 * Busca em linguagem natural ("como eu crio um lead?") por título, resumo e palavras-chave, sem
 * acento. Título pesa mais; a maior parte das palavras do assunto precisa casar.
 */
export function buscarArtigos(termo: string, artigos: readonly ArtigoAjuda[] = ARTIGOS): ArtigoAjuda[] {
  const raizes = normalizar(termo)
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 2 && !VAZIAS.has(p))
    .map(raiz);
  if (raizes.length === 0) return [];
  return artigos
    .map((a) => {
      const titulo = normalizar(a.titulo);
      const resto = normalizar(`${a.resumo} ${a.palavras.join(" ")}`);
      let nota = 0;
      let casadas = 0;
      for (const r of raizes) {
        if (titulo.includes(r)) {
          nota += 3;
          casadas += 1;
        } else if (resto.includes(r)) {
          nota += 1;
          casadas += 1;
        }
      }
      return { a, nota: casadas / raizes.length >= MINIMO_CASADO ? nota : 0 };
    })
    .filter((x) => x.nota > 0)
    .sort((x, y) => y.nota - x.nota)
    .map((x) => x.a);
}

export function artigoPorSlug(slug: string | undefined): ArtigoAjuda | null {
  return ARTIGOS.find((a) => a.slug === slug) ?? null;
}

// Map, não objeto: o slug vem da URL, e indexar um objeto comum com "constructor" ou "__proto__"
// chamaria um método herdado em vez de carregar um artigo.
const CORPOS = new Map(
  Object.entries(import.meta.glob<string>("../content/ajuda/*.md", { query: "?raw", import: "default" }))
);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Texto do artigo, baixado sob demanda. Slug fora do formato ou sem arquivo, null. */
export async function carregarCorpo(slug: string): Promise<string | null> {
  if (!SLUG.test(slug)) return null;
  const carregar = CORPOS.get(`../content/ajuda/${slug}.md`);
  return carregar ? carregar() : null;
}
