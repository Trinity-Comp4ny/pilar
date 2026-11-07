import { formatNumber } from "@/lib/format";

/**
 * Crédito de IA: a unidade que o cliente vê (DECISOES.md 2026-11-06). O motor
 * continua contando token no banco (ai_token_ledger, tokens_mensais); a UI
 * converte na razão fixa abaixo. Plano: 500 mil, 2 milhões e 8 milhões de
 * tokens viram 100, 400 e 1.600 créditos.
 */
export const TOKENS_POR_CREDITO = 5000;

/** Tokens → créditos, arredondado para baixo: saldo nunca aparece maior do que é. */
export function tokensParaCreditos(tokens: number): number {
  if (!Number.isFinite(tokens) || tokens <= 0) return 0;
  return Math.floor(tokens / TOKENS_POR_CREDITO);
}

/** Créditos → tokens, para limites digitados em créditos e gravados em tokens. */
export function creditosParaTokens(creditos: number): number {
  if (!Number.isFinite(creditos) || creditos <= 0) return 0;
  return Math.round(creditos * TOKENS_POR_CREDITO);
}

/** "1.234 créditos" / "1 crédito", a partir de um valor em tokens. */
export function formatCreditos(tokens: number): string {
  const n = tokensParaCreditos(tokens);
  return `${formatNumber(n)} ${n === 1 ? "crédito" : "créditos"}`;
}

const fmtUmaCasa = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/**
 * Consumo de um evento em créditos, com uma casa: uma pergunta curta gasta
 * menos de 1 crédito, e arredondar para baixo mostraria "0" num uso real.
 */
export function formatConsumoCreditos(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return "0";
  const valor = tokens / TOKENS_POR_CREDITO;
  return valor < 0.1 ? "< 0,1" : fmtUmaCasa.format(valor);
}
