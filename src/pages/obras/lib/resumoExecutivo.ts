// Números do cabeçalho executivo da obra: projeção do custo final e situação do prazo.

/** Abaixo disso o avanço é pouco para extrapolar o gasto: a projeção fica igual ao orçado. */
const AVANCO_MINIMO_PROJECAO = 10;

export interface ProjecaoCusto {
  /** Custo final projetado (realizado ÷ avanço). Igual ao orçado enquanto o avanço é baixo demais. */
  projetado: number;
  /** Projetado − orçado. Positivo = estouro previsto. */
  desvio: number;
  /** false quando o avanço ainda é baixo e a projeção é só o orçado. */
  extrapolada: boolean;
}

export function projecaoCusto(previsto: number, realizado: number, avancoPct: number): ProjecaoCusto | null {
  if (previsto <= 0) return null;
  if (avancoPct >= 100) return { projetado: realizado, desvio: realizado - previsto, extrapolada: true };
  if (avancoPct < AVANCO_MINIMO_PROJECAO) return { projetado: previsto, desvio: 0, extrapolada: false };
  const projetado = Math.round(realizado / (avancoPct / 100));
  return { projetado, desvio: projetado - previsto, extrapolada: true };
}

export interface SituacaoPrazo {
  /** Dias até o fim previsto; negativo = passou do prazo. */
  dias: number;
  atrasada: boolean;
}

const DIA_MS = 86_400_000;

/** `null` sem data de fim prevista. Obra 100% pronta nunca conta como atrasada. */
export function situacaoPrazo(
  fimPrevisto: string | null | undefined,
  avancoPct: number,
  hoje: Date
): SituacaoPrazo | null {
  if (!fimPrevisto) return null;
  const fim = new Date(`${fimPrevisto}T00:00:00`);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((fim.getTime() - base.getTime()) / DIA_MS);
  return { dias, atrasada: dias < 0 && avancoPct < 100 };
}
