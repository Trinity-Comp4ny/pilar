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

/** Assinar agora cobra na hora: o teste já venceu (expired, ou trialing com a data passada). */
export function cobraNaHora(sub: AssinaturaCobranca, agora: Date = new Date()): boolean {
  if (sub.status === "expired") return true;
  if (sub.status !== "trialing" || !sub.trial_ends_at) return false;
  return new Date(sub.trial_ends_at).getTime() <= agora.getTime();
}

/** Pode assinar pelo fluxo "Ativar plano": em teste ou com o teste vencido. */
export function podeAtivarPlano(sub: AssinaturaCobranca): boolean {
  return sub.status === "trialing" || sub.status === "expired";
}
