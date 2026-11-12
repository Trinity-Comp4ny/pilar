/**
 * Bug zero com prazo (SPEC 160, modelo Linear): todo problema relatado em aberto tem prazo de
 * 7 dias corridos a partir do envio. Sugestão não tem prazo: entra no roadmap.
 */
export const PRAZO_BUG_DIAS = 7;
const DIA_MS = 24 * 60 * 60 * 1000;

const ABERTOS = new Set(["novo", "em_analise", "planejado"]);

/** Dias até o prazo (negativo = atrasado) ou null quando não há prazo. */
export function diasAtePrazoDoBug(
  f: { tipo: string; status: string; createdAt: string },
  agora: number
): number | null {
  if (f.tipo !== "bug" || !ABERTOS.has(f.status)) return null;
  const vence = new Date(f.createdAt).getTime() + PRAZO_BUG_DIAS * DIA_MS;
  return Math.ceil((vence - agora) / DIA_MS);
}

export function bugVencido(f: { tipo: string; status: string; createdAt: string }, agora: number): boolean {
  const dias = diasAtePrazoDoBug(f, agora);
  return dias !== null && dias < 0;
}
