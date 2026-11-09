/**
 * Regras do lembrete de cobrança manual sem banco nem rede: quem pode enviar e
 * quando o lembrete vira aviso de atraso.
 */

export const PAPEIS_QUE_ENVIAM = ["admin", "financeiro", "operacional"] as const;

export function podeEnviarLembrete(role: string | null | undefined): boolean {
  return !!role && (PAPEIS_QUE_ENVIAM as readonly string[]).includes(role);
}

/**
 * Só parcela ainda em aberto recebe lembrete: paga, recebida ou cancelada não
 * pode virar cobrança para o cliente (o cobranca-enviar já aplica a mesma regra).
 */
export function parcelaEmAberto(status: string): boolean {
  return status === "Pendente" || status === "Atrasado";
}

/**
 * Atraso para parcela em aberto (Pendente ou já marcada Atrasado) com vencimento antes
 * de hoje (YYYY-MM-DD). Antes só "Pendente" contava, e a parcela marcada "Atrasado"
 * recebia o texto de lembrete como se ainda não tivesse vencido.
 */
export function lembreteVencido(dataVencimento: string, status: string, hoje: string): boolean {
  return dataVencimento < hoje && parcelaEmAberto(status);
}
