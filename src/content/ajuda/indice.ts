/**
 * Índice da central de ajuda (SPEC 154). Uma entrada por artigo; o texto fica em
 * `src/content/ajuda/<slug>.md`. `rotas` liga o artigo ao "?" do cabeçalho das telas e é
 * conferido contra o App em scripts/ajuda-artigos.test.ts.
 */
export type GrupoAjuda = "comecar" | "comercial" | "projetos" | "financeiro" | "equipe";

export const GRUPOS_AJUDA: readonly { id: GrupoAjuda; label: string }[] = [
  { id: "comecar", label: "Primeiros passos" },
  { id: "comercial", label: "Leads, propostas e clientes" },
  { id: "projetos", label: "Projetos" },
  { id: "financeiro", label: "Financeiro" },
  { id: "equipe", label: "Equipe e conta" },
];

export interface ArtigoAjuda {
  slug: string;
  titulo: string;
  resumo: string;
  grupo: GrupoAjuda;
  /** Telas em que o artigo aparece no "?" (a rota cobre as telas abaixo dela). */
  rotas: string[];
  /** Termos que a pessoa pode digitar na busca e não estão no título. */
  palavras: string[];
}

export const ARTIGOS: readonly ArtigoAjuda[] = [];
