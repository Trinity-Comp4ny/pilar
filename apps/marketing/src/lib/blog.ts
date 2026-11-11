import type { ModuloSlug } from "./modules";

/**
 * Blog da landing. Cada artigo é um arquivo Markdown em `src/content/blog/<slug>.md`,
 * com um frontmatter simples (uma chave por linha) e o corpo num subconjunto de
 * Markdown que `lib/markdown.tsx` sabe desenhar. Artigo novo: soltar o arquivo e
 * listar a rota em `sitemap.xml`, `llms.txt` e no prerender (o `rotas.test.ts` cobra).
 *
 * Ver o guia de escrita em `docs/marketing/seo/GUIA_BLOG.md`.
 */

export type CategoriaBlog = "Gestão" | "Projetos" | "Obra" | "Financeiro";

export interface Artigo {
  slug: string;
  titulo: string;
  /**
   * Título da aba e do resultado do Google, sem o " | Pilar". Opcional: quando o
   * título do artigo passa de ~57 caracteres, o Google corta; aqui vai a versão curta.
   */
  tituloSeo: string;
  /** Meta description: 120 a 155 caracteres, com a palavra-chave. */
  descricao: string;
  palavraChave: string;
  categoria: CategoriaBlog;
  /** Módulo do CTA do fim do artigo. */
  modulo: ModuloSlug;
  publicadoEm: string;
  atualizadoEm: string;
  resumo: string;
  autor: string;
  corpo: string;
  minutosLeitura: number;
}

const CATEGORIAS: CategoriaBlog[] = ["Gestão", "Projetos", "Obra", "Financeiro"];
const MODULOS_VALIDOS: ModuloSlug[] = ["gestao", "projetos", "obra", "portal", "campo"];
const OBRIGATORIOS = ["titulo", "descricao", "palavraChave", "categoria", "modulo", "publicadoEm", "resumo"] as const;

/** Lê um arquivo de artigo. Lança erro claro quando falta campo: o build quebra cedo. */
export function lerArtigo(slug: string, fonte: string): Artigo {
  const m = fonte.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`blog/${slug}.md sem frontmatter entre ---`);

  const campos: Record<string, string> = {};
  for (const linha of m[1].split("\n")) {
    const i = linha.indexOf(":");
    if (i <= 0) continue;
    campos[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
  }
  for (const chave of OBRIGATORIOS) {
    if (!campos[chave]) throw new Error(`blog/${slug}.md sem o campo "${chave}"`);
  }
  if (!CATEGORIAS.includes(campos.categoria as CategoriaBlog)) {
    throw new Error(`blog/${slug}.md: categoria "${campos.categoria}" fora de ${CATEGORIAS.join(", ")}`);
  }
  if (!MODULOS_VALIDOS.includes(campos.modulo as ModuloSlug)) {
    throw new Error(`blog/${slug}.md: módulo "${campos.modulo}" não existe`);
  }

  const corpo = m[2].trim();
  const palavras = corpo.split(/\s+/).filter(Boolean).length;
  return {
    slug,
    titulo: campos.titulo,
    tituloSeo: campos.tituloSeo || campos.titulo,
    descricao: campos.descricao,
    palavraChave: campos.palavraChave,
    categoria: campos.categoria as CategoriaBlog,
    modulo: campos.modulo as ModuloSlug,
    publicadoEm: campos.publicadoEm,
    atualizadoEm: campos.atualizadoEm || campos.publicadoEm,
    resumo: campos.resumo,
    autor: campos.autor || "Time Pilar",
    corpo,
    // 200 palavras por minuto: leitura de texto técnico, com tabela e lista.
    minutosLeitura: Math.max(1, Math.round(palavras / 200)),
  };
}

const ARQUIVOS = import.meta.glob("../content/blog/*.md", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

/** Todos os artigos, do mais recente para o mais antigo. */
export const ARTIGOS: Artigo[] = Object.entries(ARQUIVOS)
  .map(([caminho, fonte]) => lerArtigo(caminho.replace(/^.*\/(.+)\.md$/, "$1"), fonte))
  .sort((a, b) => b.publicadoEm.localeCompare(a.publicadoEm) || a.titulo.localeCompare(b.titulo));

export const ARTIGOS_POR_SLUG: Record<string, Artigo> = Object.fromEntries(ARTIGOS.map((a) => [a.slug, a]));

/** Data por extenso em pt-BR ("10 de novembro de 2026"), sem depender do fuso do visitante. */
export function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const MESES = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return `${dia} de ${MESES[mes - 1]} de ${ano}`;
}

/** Artigos para "Continue lendo": mesma categoria primeiro, depois os mais recentes. */
export function relacionados(artigo: Artigo, quantos = 3): Artigo[] {
  const outros = ARTIGOS.filter((a) => a.slug !== artigo.slug);
  const mesma = outros.filter((a) => a.categoria === artigo.categoria);
  const resto = outros.filter((a) => a.categoria !== artigo.categoria);
  return [...mesma, ...resto].slice(0, quantos);
}
