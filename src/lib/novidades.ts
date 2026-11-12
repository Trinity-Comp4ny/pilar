import type { FeatureKey } from "@/lib/features";

/**
 * Novidades do produto (SPEC 152). A fonte é a RPC `novidades_publicadas`, que já devolve só
 * release publicada, com `nova` (publicada depois do que o usuário viu) e `voce_pediu` (algum
 * feedback dele originou o item) calculados no banco.
 *
 * Regra editorial: `fluxo` muda o caminho de algo que a pessoa já fazia e abre o modal "O que
 * mudou"; `melhoria` acende o ponto em Novidades; `correcao` só entra na lista.
 */
export type Impacto = "fluxo" | "melhoria" | "correcao";

export const IMPACTOS: readonly Impacto[] = ["fluxo", "melhoria", "correcao"];

export interface NovidadeItem {
  id: string;
  texto: string;
  impacto: Impacto;
  modulo: string | null;
  voce_pediu: boolean;
}

export interface NovidadeRelease {
  id: string;
  sha: string | null;
  titulo: string;
  versao: string | null;
  publicada_em: string;
  nova: boolean;
  itens: NovidadeItem[];
}

export interface Novidades {
  visto_ate: string | null;
  releases: NovidadeRelease[];
}

const VAZIO: Novidades = { visto_ate: null, releases: [] };

// Validação à mão, sem zod: este módulo vai no carregamento inicial (sidebar e aviso de versão) e
// o zod pesaria ~30 kB gzip no boot só para conferir este formato.
const ehTexto = (v: unknown): v is string => typeof v === "string";
const ehTextoOuNulo = (v: unknown): v is string | null => v === null || typeof v === "string";

function lerItem(v: unknown): NovidadeItem | null {
  if (typeof v !== "object" || v === null) return null;
  const i = v as Record<string, unknown>;
  if (!ehTexto(i.id) || !ehTexto(i.texto) || !ehTextoOuNulo(i.modulo) || typeof i.voce_pediu !== "boolean") return null;
  if (!IMPACTOS.includes(i.impacto as Impacto)) return null;
  return { id: i.id, texto: i.texto, impacto: i.impacto as Impacto, modulo: i.modulo, voce_pediu: i.voce_pediu };
}

function lerRelease(v: unknown): NovidadeRelease | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  if (!ehTexto(r.id) || !ehTextoOuNulo(r.sha) || !ehTexto(r.titulo) || !ehTextoOuNulo(r.versao)) return null;
  if (!ehTexto(r.publicada_em) || typeof r.nova !== "boolean" || !Array.isArray(r.itens)) return null;
  const itens = r.itens.map(lerItem);
  if (itens.some((x) => x === null)) return null;
  return {
    id: r.id,
    sha: r.sha,
    titulo: r.titulo,
    versao: r.versao,
    publicada_em: r.publicada_em,
    nova: r.nova,
    itens: itens as NovidadeItem[],
  };
}

/** Lê a resposta da RPC. Formato inesperado vira lista vazia: novidade nunca derruba a tela. */
export function lerNovidades(json: unknown): Novidades {
  if (typeof json !== "object" || json === null) return VAZIO;
  const d = json as Record<string, unknown>;
  if (!ehTextoOuNulo(d.visto_ate) || !Array.isArray(d.releases)) return VAZIO;
  const releases = d.releases.map(lerRelease);
  if (releases.some((x) => x === null)) return VAZIO;
  return { visto_ate: d.visto_ate, releases: releases as NovidadeRelease[] };
}

/** Item vale para quem chama: sem módulo, ou com módulo que a pessoa acessa. */
export type PodeVerModulo = (modulo: FeatureKey) => boolean;

function itemDaPessoa(item: NovidadeItem, pode: PodeVerModulo): boolean {
  return item.modulo === null || pode(item.modulo as FeatureKey);
}

export interface Pendentes {
  /** Releases novas com pelo menos uma mudança de fluxo para a pessoa (abre o modal). */
  comFluxo: NovidadeRelease[];
  /** Há novidade não vista que merece o ponto no menu (fluxo ou melhoria). */
  temDestaque: boolean;
}

export function novidadesPendentes(releases: NovidadeRelease[], pode: PodeVerModulo): Pendentes {
  const novas = releases.filter((r) => r.nova);
  const comFluxo = novas
    .map((r) => ({ ...r, itens: r.itens.filter((i) => itemDaPessoa(i, pode)) }))
    .filter((r) => r.itens.some((i) => i.impacto === "fluxo"));
  const temDestaque = novas.some((r) => r.itens.some((i) => i.impacto !== "correcao" && itemDaPessoa(i, pode)));
  return { comFluxo, temDestaque };
}

/** Release do sha servido agora, para o toast de versão nova dizer o que veio. */
export function releaseDoSha(releases: NovidadeRelease[], sha: string | null): NovidadeRelease | null {
  if (!sha) return null;
  const alvo = sha.toLowerCase();
  return releases.find((r) => r.sha && (alvo.startsWith(r.sha) || r.sha.startsWith(alvo))) ?? null;
}

/** "1 novidade" / "3 novidades". */
export function contagemNovidades(total: number): string {
  return total === 1 ? "1 novidade" : `${total} novidades`;
}
