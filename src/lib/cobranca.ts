// Estado de cobrança derivado da assinatura (SPEC 078/104). Espelha
// ehConvidada() da edge ultra-admin-empresas: sem coluna própria, o par
// status/asaas_subscription_id já é a verdade.

interface AssinaturaCobranca {
  status: string;
  trial_ends_at: string | null;
  asaas_subscription_id?: string | null;
}

/** Convidada: não paga e não está em prazo. Sem assinatura conta como convidada (empresas antigas). */
export function ehConvidada(sub: AssinaturaCobranca | null | undefined): boolean {
  if (!sub) return true;
  return sub.status === "active" && !sub.asaas_subscription_id;
}

/** Assinar agora cobra na hora: teste vencido (ou trialing com a data passada) ou assinatura cancelada. */
export function cobraNaHora(sub: AssinaturaCobranca, agora: Date = new Date()): boolean {
  if (sub.status === "expired" || sub.status === "canceled") return true;
  if (sub.status !== "trialing" || !sub.trial_ends_at) return false;
  return new Date(sub.trial_ends_at).getTime() <= agora.getTime();
}

/** Pode assinar pelo fluxo "Ativar plano": em teste, com o teste vencido ou depois de cancelar. */
export function podeAtivarPlano(sub: AssinaturaCobranca): boolean {
  return sub.status === "trialing" || sub.status === "expired" || sub.status === "canceled";
}

/**
 * Status usado pelo gate de acesso. Cancelada sem estorno mantém o acesso até
 * o fim do período pago (o que o diálogo de cancelamento e os Termos
 * prometem). Com estorno, o servidor encerra o período na hora e cai no
 * bloqueio normal.
 */
export function statusDeAcesso(
  sub: { status: string | null; current_period_end: string | null } | null,
  agora: Date = new Date()
): string | null {
  if (!sub) return null;
  if (sub.status === "canceled" && sub.current_period_end && new Date(sub.current_period_end) > agora) {
    return "active";
  }
  return sub.status;
}

/** Até 7 dias da primeira cobrança o cancelamento estorna o valor inteiro (SPEC 098). */
export function estaNoPrazoDeArrependimento(primeiraCobrancaEm: string | null, agora: Date = new Date()): boolean {
  if (!primeiraCobrancaEm) return false;
  return agora.getTime() - new Date(primeiraCobrancaEm).getTime() <= 7 * 24 * 60 * 60 * 1000;
}
