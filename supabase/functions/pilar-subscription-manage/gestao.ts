/**
 * Regras do pilar-subscription-manage, sem banco nem rede: quando a assinatura pode
 * ser gerenciada, quando o cancelamento estorna (arrependimento de 7 dias, SPEC 098
 * requisito 18) e quanto a troca de plano passa a cobrar. O index.ts faz auth, Asaas
 * e banco; separado para teste porque é regra de dinheiro.
 */

import type { UpdateSubscriptionParams } from "../_shared/asaas-platform.ts";

const DIA_MS = 24 * 60 * 60 * 1000;
export const PRAZO_ARREPENDIMENTO_DIAS = 7;

export interface AssinaturaGerenciada {
  id: string;
  asaas_subscription_id: string | null;
  plan_id: string | null;
  billing_cycle: string | null;
  status: string;
  current_period_start: string | null;
}

export interface PlanoNovo {
  id: string;
  slug: string;
  nome: string;
  preco_mensal: number | null;
  preco_anual: number | null;
}

type Recusa = { ok: false; status: number; error: string };

/** Sem assinatura é 404; sem referência no Asaas não há o que gerenciar (400). */
export function verificarAssinatura(
  sub: AssinaturaGerenciada | null
): { ok: true; sub: AssinaturaGerenciada & { asaas_subscription_id: string } } | Recusa {
  if (!sub) return { ok: false, status: 404, error: "Assinatura não encontrada" };
  if (!sub.asaas_subscription_id) return { ok: false, status: 400, error: "Assinatura sem referência Asaas" };
  return { ok: true, sub: { ...sub, asaas_subscription_id: sub.asaas_subscription_id } };
}

/** Cancelar de novo uma assinatura já cancelada é erro do usuário, não chamada ao Asaas. */
export function verificarCancelamento(status: string): { ok: true } | Recusa {
  if (status === "canceled") return { ok: false, status: 400, error: "Assinatura já cancelada" };
  return { ok: true };
}

/**
 * Até 7 dias depois da 1ª cobrança (current_period_start, gravado na conversão) o
 * cancelamento estorna integralmente. Sem data de início, não há estorno.
 */
export function dentroDoArrependimento(currentPeriodStart: string | null, agora: number): boolean {
  if (!currentPeriodStart) return false;
  return agora - new Date(currentPeriodStart).getTime() <= PRAZO_ARREPENDIMENTO_DIAS * DIA_MS;
}

/** Só estorna a 1ª cobrança se ela foi de fato paga (confirmada ou recebida). */
export function cobrancaParaEstornar<P extends { id: string; status: string }>(payments: P[]): P | null {
  const primeira = payments[0];
  if (!primeira) return null;
  return primeira.status === "CONFIRMED" || primeira.status === "RECEIVED" ? primeira : null;
}

/**
 * O que gravar ao cancelar. Com estorno o dinheiro voltou e o acesso termina agora;
 * sem estorno, segue até o fim do período pago (o que a tela e os Termos prometem).
 */
export function alteracoesDoCancelamento(
  refunded: boolean,
  agora: Date
): { status: "canceled"; canceled_at: string; current_period_end?: string } {
  return {
    status: "canceled",
    canceled_at: agora.toISOString(),
    ...(refunded ? { current_period_end: agora.toISOString() } : {}),
  };
}

export type TrocaDePlano =
  { ok: true; cycle: "monthly" | "yearly"; value: number; asaas: UpdateSubscriptionParams } | Recusa;

/**
 * Ciclo novo: o pedido, senão o atual, senão mensal. O valor vem sempre do plano no
 * banco; plano sem preço nesse ciclo é recusado antes de chamar o Asaas.
 */
export function planejarTrocaDePlano(
  plano: PlanoNovo,
  cicloPedido: "monthly" | "yearly" | undefined,
  cicloAtual: string | null
): TrocaDePlano {
  const cycle = (cicloPedido ?? cicloAtual ?? "monthly") as "monthly" | "yearly";
  const value = cycle === "yearly" ? plano.preco_anual : plano.preco_mensal;
  if (!value || value <= 0) return { ok: false, status: 400, error: "Valor do plano indisponível" };
  return {
    ok: true,
    cycle,
    value,
    asaas: {
      value,
      cycle: cycle === "yearly" ? "YEARLY" : "MONTHLY",
      description: `Pilar ${plano.nome} — assinatura ${cycle === "yearly" ? "anual" : "mensal"}`,
      updatePendingPayments: true,
    },
  };
}
