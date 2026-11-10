/**
 * Voz do cliente (SPEC 156): quando perguntar NPS e esforço, e como ler as respostas.
 * Regra pura, sem rede, para testar.
 *
 * - NPS: só depois de 14 dias de conta, no máximo 1 vez a cada 90 dias (dispensar conta).
 * - CES: depois de um fluxo, sorteio de 1 em 5, no máximo 1 vez a cada 30 dias por fluxo.
 */
export const DIA_MS = 24 * 60 * 60 * 1000;
export const NPS_CONTA_MINIMA_DIAS = 14;
export const NPS_INTERVALO_DIAS = 90;
export const CES_INTERVALO_DIAS = 30;
export const CES_AMOSTRA = 0.2;

export interface RespostaPropria {
  tipo: "nps" | "ces";
  fluxo: string | null;
  created_at: string;
}

export function podeMostrarNps(contaCriadaEm: string | null, respostas: RespostaPropria[], agora: number): boolean {
  if (!contaCriadaEm) return false;
  if (agora - new Date(contaCriadaEm).getTime() < NPS_CONTA_MINIMA_DIAS * DIA_MS) return false;
  return !respostas.some(
    (r) => r.tipo === "nps" && agora - new Date(r.created_at).getTime() < NPS_INTERVALO_DIAS * DIA_MS
  );
}

export function podePerguntarEsforco(
  fluxo: string,
  respostas: RespostaPropria[],
  agora: number,
  sorteio: number
): boolean {
  if (sorteio >= CES_AMOSTRA) return false;
  return !respostas.some(
    (r) =>
      r.tipo === "ces" && r.fluxo === fluxo && agora - new Date(r.created_at).getTime() < CES_INTERVALO_DIAS * DIA_MS
  );
}

export interface ResumoNps {
  respostas: number;
  promotores: number;
  neutros: number;
  detratores: number;
  /** -100 a 100; null sem resposta. */
  nps: number | null;
}

export function calcularNps(notas: number[]): ResumoNps {
  const promotores = notas.filter((n) => n >= 9).length;
  const detratores = notas.filter((n) => n <= 6).length;
  const neutros = notas.length - promotores - detratores;
  const nps = notas.length ? Math.round(((promotores - detratores) / notas.length) * 100) : null;
  return { respostas: notas.length, promotores, neutros, detratores, nps };
}

/** Fluxos avaliados pela pergunta de esforço e o nome mostrado no Ultra admin. */
export const FLUXOS_CES: Record<string, string> = {
  lancamento: "Lançar receita ou despesa",
  proposta: "Criar proposta",
  lead: "Criar lead",
};
