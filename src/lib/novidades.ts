import { z } from "zod";
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

const itemSchema = z.object({
  id: z.string(),
  texto: z.string(),
  impacto: z.enum(["fluxo", "melhoria", "correcao"]),
  modulo: z.string().nullable(),
  voce_pediu: z.boolean(),
});

const releaseSchema = z.object({
  id: z.string(),
  sha: z.string().nullable(),
  titulo: z.string(),
  versao: z.string().nullable(),
  publicada_em: z.string(),
  nova: z.boolean(),
  itens: z.array(itemSchema),
});

const respostaSchema = z.object({
  visto_ate: z.string().nullable(),
  releases: z.array(releaseSchema),
});

export type NovidadeItem = z.infer<typeof itemSchema>;
export type NovidadeRelease = z.infer<typeof releaseSchema>;
export type Novidades = z.infer<typeof respostaSchema>;

const VAZIO: Novidades = { visto_ate: null, releases: [] };

/** Lê a resposta da RPC. Formato inesperado vira lista vazia: novidade nunca derruba a tela. */
export function lerNovidades(json: unknown): Novidades {
  const lido = respostaSchema.safeParse(json);
  return lido.success ? lido.data : VAZIO;
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
