/**
 * Janelas de aviso de fim de trial (SPEC 104), sem banco nem rede.
 *
 * Cada janela cobre exatamente 1 dia: o aviso de N dias sai quando o
 * restante está em (N-1, N]. Com o cron de hora em hora, o aviso chega no
 * máximo 1h depois de entrar na janela.
 *
 * Não existe aviso de 3 dias: num trial de 3 dias ele sairia no próprio dia
 * do cadastro. O de 7 dias só alcança prazos longos (cancelamento de convite
 * com prazo de 7+ dias); num trial de 3 dias o restante nunca passa de 3.
 */

export const JANELAS_DE_AVISO = [
  { days: 7, column: "trial_warning_7d_sent_at", action: "trial_warning_sent_d7" },
  { days: 1, column: "trial_warning_1d_sent_at", action: "trial_warning_sent_d1" },
] as const;

export type JanelaDeAviso = (typeof JANELAS_DE_AVISO)[number];

const DIA_MS = 24 * 60 * 60 * 1000;

/** Limites de trial_ends_at para a janela de N dias: (agora+N-1d, agora+Nd]. */
export function limitesDaJanela(days: number, agora: Date): { depoisDe: string; ateInclusive: string } {
  return {
    depoisDe: new Date(agora.getTime() + (days - 1) * DIA_MS).toISOString(),
    ateInclusive: new Date(agora.getTime() + days * DIA_MS).toISOString(),
  };
}

export interface TrialVencido {
  id: string;
  empresa_id: string;
  plan_id: string | null;
  billing_cycle: string | null;
  asaas_customer_id: string | null;
  asaas_credit_card_token: string | null;
}

/**
 * Trial vencido converte em assinatura ativa só se o admin ativou o plano: cartão
 * tokenizado, cliente no Asaas e plano escolhido. Faltando qualquer um, expira (modo
 * leitura). A ordem de entrada é preservada nas duas listas.
 */
export function separarTrialsVencidos<T extends TrialVencido>(rows: T[]): { converter: T[]; expirar: T[] } {
  const podeConverter = (r: T) => !!(r.asaas_credit_card_token && r.asaas_customer_id && r.plan_id);
  return { converter: rows.filter(podeConverter), expirar: rows.filter((r) => !podeConverter(r)) };
}
