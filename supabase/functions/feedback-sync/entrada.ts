/**
 * Corpo aceito pelo feedback-sync (SPEC 145): { ids: uuid[], alvo: "planejado" | "resolvido" }.
 * A automação só avança o status; nunca mexe em `resolvido` nem em `descartado`.
 */
export type AlvoFeedback = "planejado" | "resolvido";

export const MAX_IDS = 100;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Status de partida que podem ir para cada alvo. */
export const PARTIDAS: Record<AlvoFeedback, string[]> = {
  planejado: ["novo", "em_analise"],
  resolvido: ["novo", "em_analise", "planejado"],
};

export type Entrada = { ok: true; ids: string[]; alvo: AlvoFeedback } | { ok: false; erro: string };

export function lerEntrada(corpo: unknown): Entrada {
  if (typeof corpo !== "object" || corpo === null) return { ok: false, erro: "corpo inválido" };
  const { ids, alvo } = corpo as { ids?: unknown; alvo?: unknown };
  if (alvo !== "planejado" && alvo !== "resolvido") return { ok: false, erro: "alvo deve ser planejado ou resolvido" };
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, erro: "ids deve ser uma lista não vazia" };
  if (ids.length > MAX_IDS) return { ok: false, erro: `no máximo ${MAX_IDS} ids por chamada` };
  if (!ids.every((id) => typeof id === "string" && UUID.test(id))) return { ok: false, erro: "id inválido" };
  const unicos = [...new Set((ids as string[]).map((id) => id.toLowerCase()))];
  return { ok: true, ids: unicos, alvo };
}
