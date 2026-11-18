/**
 * Calculadora de margem líquida da proposta (SPEC 168).
 *
 * Margem líquida = o que sobra do preço depois do custo, do imposto e da taxa
 * do meio de recebimento (todos em % do preço). Funções puras, sem I/O.
 * Percentuais entram e saem em pontos percentuais (30 = 30%).
 */

export interface ParametrosMargem {
  /** Alíquota efetiva de imposto sobre a receita (%). */
  impostoPct: number;
  /** Taxa do meio de recebimento (%), ex. cartão. */
  taxaPct: number;
}

export type SemaforoMargem = "verde" | "amarelo" | "vermelho";

const num = (v: number | null | undefined): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const arredonda = (v: number): number => Math.round(v * 100) / 100;

/** Soma imposto + taxa em fração do preço. */
const deducoes = (p: ParametrosMargem): number => (num(p.impostoPct) + num(p.taxaPct)) / 100;

/**
 * Preço que entrega a margem líquida desejada: custo / (1 - margem - imposto - taxa).
 * Retorna null quando a conta é impossível (denominador <= 0) ou o custo é zero.
 */
export const precoSugerido = (custo: number, margemPct: number, p: ParametrosMargem): number | null => {
  const c = num(custo);
  if (c <= 0) return null;
  const denominador = 1 - num(margemPct) / 100 - deducoes(p);
  if (denominador <= 0) return null;
  return arredonda(c / denominador);
};

/** Margem líquida (%) de um preço: 1 - custo/preço - imposto - taxa. Null sem preço. */
export const margemLiquidaPct = (preco: number, custo: number, p: ParametrosMargem): number | null => {
  const v = num(preco);
  if (v <= 0) return null;
  return (1 - num(custo) / v - deducoes(p)) * 100;
};

/** Quanto sobra em reais depois de custo, imposto e taxa. */
export const lucroLiquido = (preco: number, custo: number, p: ParametrosMargem): number =>
  arredonda(num(preco) * (1 - deducoes(p)) - num(custo));

/**
 * Maior desconto (%) sobre o preço de tabela que ainda mantém a margem mínima.
 * Use margemMinimaPct = 0 para o desconto de empate. Nunca negativo; null quando
 * não há como calcular. Quando o preço de tabela já está abaixo do mínimo, é 0.
 */
export const descontoMaximoPct = (
  precoTabela: number,
  custo: number,
  margemMinimaPct: number,
  p: ParametrosMargem
): number | null => {
  const tabela = num(precoTabela);
  if (tabela <= 0) return null;
  const piso = precoSugerido(custo, margemMinimaPct, p);
  if (piso === null) return null;
  return Math.max(0, (1 - piso / tabela) * 100);
};

/** Aplica um desconto percentual ao preço de tabela. */
export const aplicaDesconto = (precoTabela: number, descontoPct: number): number =>
  arredonda(num(precoTabela) * (1 - Math.min(Math.max(num(descontoPct), 0), 100) / 100));

/** Verde: >= alvo. Amarelo: entre mínima e alvo. Vermelho: abaixo da mínima. */
export const semaforoMargem = (margemPct: number | null, alvoPct: number, minimaPct: number): SemaforoMargem | null => {
  if (margemPct === null) return null;
  if (margemPct >= num(alvoPct)) return "verde";
  if (margemPct >= num(minimaPct)) return "amarelo";
  return "vermelho";
};

export interface MeioRecebimento {
  id: string;
  nome: string;
  /** Taxa fixa (%) para meios sem parcelamento (PIX, boleto). */
  taxa_pct: number;
  /** Taxa (%) por número de parcelas, para cartão. Chave = nº de parcelas. */
  faixas?: Record<string, number>;
}

/** Taxa efetiva (%) de um meio para o número de parcelas informado. */
export const taxaDoMeio = (meio: MeioRecebimento | undefined, parcelas: number): number => {
  if (!meio) return 0;
  const faixas = meio.faixas ?? {};
  const chaves = Object.keys(faixas)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 1)
    .sort((a, b) => a - b);
  if (chaves.length === 0) return num(meio.taxa_pct);
  const alvo = Math.max(1, Math.floor(num(parcelas)) || 1);
  // Usa a maior faixa cadastrada que não passa do nº de parcelas; senão a menor.
  const faixa = [...chaves].reverse().find((n) => n <= alvo) ?? chaves[0];
  return num(faixas[String(faixa)]);
};
