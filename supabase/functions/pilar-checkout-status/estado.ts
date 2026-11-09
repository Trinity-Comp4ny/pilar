/**
 * Decisões do polling de status do checkout, sem banco nem rede: quando consultar o
 * Asaas, quando a cobrança conta como paga e quando o convite precisa sair por aqui
 * (fallback do webhook).
 */

/** Status do Asaas que liberam o acesso. */
export function pagamentoConfirmado(statusAsaas: string): boolean {
  return statusAsaas === "CONFIRMED" || statusAsaas === "RECEIVED";
}

/** Só vale ir ao Asaas enquanto o signup está pendente e já tem a cobrança criada. */
export function deveConsultarAsaas(signup: { payment_status: string; asaas_payment_id: string | null }): boolean {
  return signup.payment_status === "pending" && !!signup.asaas_payment_id;
}

/** Pago e sem convite enviado: o webhook falhou ou ainda não chegou, então o convite sai por aqui. */
export function deveEnviarConvite(signup: { payment_status: string; invite_dispatched_at: string | null }): boolean {
  return signup.payment_status === "paid" && !signup.invite_dispatched_at;
}

/** Data do pagamento informada pelo Asaas; sem ela, o momento da consulta. */
export function pagoEm(paymentDate: string | undefined, agora: Date): string {
  return paymentDate ? new Date(paymentDate).toISOString() : agora.toISOString();
}
