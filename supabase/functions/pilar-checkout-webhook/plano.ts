/**
 * Decisão do pilar-checkout-webhook, sem banco nem rede: dado o evento do Asaas e o
 * que foi encontrado (signup pendente, assinatura, compra de tokens), diz o que o
 * index.ts deve gravar. O index.ts só busca os registros e executa o plano.
 *
 * Separado para ser testável: é aqui que mora a regra de dinheiro (quem é liberado,
 * quanto token entra no ledger, quando a assinatura vira overdue ou canceled).
 */

export interface SignupEncontrado {
  id: string;
  payment_status: string;
  invite_dispatched_at: string | null;
}

export interface AssinaturaEncontrada {
  id: string;
  empresa_id: string;
  billing_cycle: string | null;
}

export interface CompraTokensEncontrada {
  id: string;
  quantidade_pacotes: number;
  tokens_pacote: number;
  status: string;
}

export interface Encontrados {
  signup: SignupEncontrado | null;
  assinatura: AssinaturaEncontrada | null;
  compra: CompraTokensEncontrada | null;
}

export interface PlanoWebhook {
  // Pagamento recebido
  marcarSignupPago: boolean;
  dispararConvite: boolean;
  definirTrial: boolean;
  marcarCompraPaga: boolean;
  /** Crédito no ai_token_ledger, sempre tentado: o UNIQUE em reference_id é a idempotência. */
  creditoTokens: { tokens: number; referenceId: string } | null;
  /** Fim do novo período da assinatura renovada (e sai do modo somente leitura). */
  renovarAssinaturaAte: string | null;
  // Inadimplência, estorno, fim de assinatura
  statusAssinatura: "overdue" | "canceled" | null;
  /** Estorno devolveu o dinheiro: o acesso pago termina agora, não no fim do período. */
  encerrarAcessoAgora: boolean;
  statusSignup: "failed" | "canceled" | null;
  statusCompra: "failed" | "canceled" | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;

export const EVENTOS_PAGAMENTO_RECEBIDO = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];
export const EVENTOS_ESTORNO = ["PAYMENT_REFUNDED", "PAYMENT_DELETED"];
export const EVENTOS_FIM_ASSINATURA = ["SUBSCRIPTION_ENDED", "SUBSCRIPTION_DELETED"];

/** Data do pagamento informada pelo Asaas; sem ela, o momento do processamento. */
export function dataPagamento(paymentDate: string | undefined, agora: Date): string {
  return paymentDate ? new Date(paymentDate).toISOString() : agora.toISOString();
}

/** Renovação: 365 dias no ciclo anual, 30 em qualquer outro (inclusive ciclo nulo). */
export function fimDoPeriodo(billingCycle: string | null, agora: Date): string {
  const dias = billingCycle === "yearly" ? 365 : 30;
  return new Date(agora.getTime() + dias * DIA_MS).toISOString();
}

export function referenciaCompraTokens(compraId: string): string {
  return `token_pack_purchase:${compraId}`;
}

export function planejarWebhook(
  evento: string,
  { signup, assinatura, compra }: Encontrados,
  agora: Date
): PlanoWebhook {
  const plano: PlanoWebhook = {
    marcarSignupPago: false,
    dispararConvite: false,
    definirTrial: false,
    marcarCompraPaga: false,
    creditoTokens: null,
    renovarAssinaturaAte: null,
    encerrarAcessoAgora: false,
    statusAssinatura: null,
    statusSignup: null,
    statusCompra: null,
  };

  if (EVENTOS_PAGAMENTO_RECEBIDO.includes(evento)) {
    plano.marcarSignupPago = !!signup && signup.payment_status !== "paid";
    plano.dispararConvite = !!signup && !signup.invite_dispatched_at;
    plano.definirTrial = !!signup;
    if (compra) {
      plano.marcarCompraPaga = compra.status !== "paid";
      // Credita mesmo com status já 'paid': cartão instantâneo chega aqui pago, e o
      // crédito ainda não aconteceu. Replay não duplica por causa do UNIQUE.
      plano.creditoTokens = {
        tokens: compra.quantidade_pacotes * compra.tokens_pacote,
        referenceId: referenciaCompraTokens(compra.id),
      };
    }
    // Pagamento de signup novo não é renovação: a assinatura dele nasce no profile-setup.
    if (assinatura && !signup) {
      plano.renovarAssinaturaAte = fimDoPeriodo(assinatura.billing_cycle, agora);
    }
  }

  if (evento === "PAYMENT_OVERDUE") {
    if (assinatura) plano.statusAssinatura = "overdue";
    if (signup?.payment_status === "pending") plano.statusSignup = "failed";
    if (compra?.status === "pending") plano.statusCompra = "failed";
  }

  if (EVENTOS_ESTORNO.includes(evento)) {
    if (signup) plano.statusSignup = "canceled";
    if (assinatura) {
      plano.statusAssinatura = "canceled";
      plano.encerrarAcessoAgora = true;
    }
    // Compra já creditada não é estornada no ledger (risco aceito, SPEC 077).
    if (compra && compra.status !== "paid") plano.statusCompra = "canceled";
  }

  if (EVENTOS_FIM_ASSINATURA.includes(evento) && assinatura) {
    plano.statusAssinatura = "canceled";
  }

  return plano;
}
