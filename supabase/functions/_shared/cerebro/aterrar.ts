// SPEC 169 / ADR 0050: o insight só vale se a citação existir, literal, no transcript
// redigido. Busca normalizada (caixa, acento, espaço). Sem citação, o insight é descartado
// e a confiança do conjunto cai. Função pura.

export interface InsightBruto {
  texto: string;
  citacao: string;
  [k: string]: unknown;
}

export interface ResultadoAterramento<T extends InsightBruto> {
  aceitos: T[];
  descartados: T[];
  /** 1 = todos aterrados; cai proporcionalmente ao descarte. */
  confianca: number;
}

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function citacaoExiste(transcript: string, citacao: string): boolean {
  const c = normalizar(citacao);
  if (c.length < 8) return false;
  return normalizar(transcript).includes(c);
}

export function aterrar<T extends InsightBruto>(transcript: string, insights: T[]): ResultadoAterramento<T> {
  const aceitos: T[] = [];
  const descartados: T[] = [];
  for (const i of insights) (citacaoExiste(transcript, i.citacao) ? aceitos : descartados).push(i);
  const confianca = insights.length === 0 ? 1 : aceitos.length / insights.length;
  return { aceitos, descartados, confianca };
}
