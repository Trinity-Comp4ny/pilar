/**
 * Regras do asaas-webhook (cobrança do cliente da empresa), sem banco nem rede.
 * O index.ts busca configs e receita; aqui fica quem o token autoriza e o que cada
 * evento muda na receita. Separado para teste: é a fronteira entre tenants.
 */
import { safeEqual } from "../_shared/crypto.ts";

export interface ConfigWebhook {
  empresa_id: string;
  webhook_token: string | null;
}

export type Autorizacao =
  | { valido: false }
  /** empresaId null = token global de env (dev/staging): sem empresa para restringir a busca. */
  | { valido: true; empresaId: string | null };

/**
 * O token de webhook de cada empresa (asaas_config.webhook_token) identifica o
 * tenant, e a receita só é buscada dentro dele. O token global de env é fallback
 * de dev/staging.
 */
export function autorizarToken(
  recebido: string | null,
  configs: ConfigWebhook[],
  tokenGlobal: string | undefined
): Autorizacao {
  if (!recebido) return { valido: false };
  const cfg = configs.find((c) => !!c.webhook_token && safeEqual(recebido, c.webhook_token));
  if (cfg) return { valido: true, empresaId: cfg.empresa_id };
  if (tokenGlobal && safeEqual(recebido, tokenGlobal)) return { valido: true, empresaId: null };
  return { valido: false };
}

const STATUS_POR_EVENTO: Record<string, string | null> = {
  PAYMENT_RECEIVED: "Recebido",
  PAYMENT_CONFIRMED: "Recebido",
  PAYMENT_RECEIVED_IN_CASH: "Recebido",
  PAYMENT_OVERDUE: "Atrasado",
  // Só espelha o status do Asaas, sem mexer no status da receita.
  PAYMENT_DELETED: null,
  PAYMENT_REFUNDED: null,
  PAYMENT_AWAITING_RISK_ANALYSIS: null,
};

export interface AtualizacaoReceita {
  campos: Record<string, unknown>;
  /** Marco de faturamento vinculado passa de 'faturado' para 'recebido'. */
  marcarMarcoRecebido: boolean;
}

/** null = evento que não mexe na receita. `hoje` no formato YYYY-MM-DD. */
export function atualizacaoDaReceita(
  evento: string,
  pagamento: { status: string; paymentDate?: string },
  hoje: string
): AtualizacaoReceita | null {
  // hasOwn, não `in`: evento "toString" não pode cair no protótipo do objeto.
  if (!Object.hasOwn(STATUS_POR_EVENTO, evento)) return null;
  const novoStatus = STATUS_POR_EVENTO[evento];
  const campos: Record<string, unknown> = { asaas_payment_status: pagamento.status };
  if (novoStatus !== null) campos.status = novoStatus;
  const recebido = novoStatus === "Recebido";
  if (recebido) campos.data_recebimento = pagamento.paymentDate ?? hoje;
  return { campos, marcarMarcoRecebido: recebido };
}
