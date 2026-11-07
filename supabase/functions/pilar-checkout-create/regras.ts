/**
 * Decisões do pilar-checkout-create sem banco nem rede: quanto cobrar, com que status
 * o signup nasce e o que o front recebe para renderizar PIX/boleto. O index.ts faz
 * banco e Asaas; separado para teste porque é regra de dinheiro.
 */

import type { AsaasPayment } from "../_shared/asaas-platform.ts";
import type { CheckoutPayload } from "./entrada.ts";

/** Valor do ciclo escolhido, sempre do plano no banco. null = plano sem preço válido nesse ciclo. */
export function valorDoPlano(
  plan: { preco_mensal: number | null; preco_anual: number | null },
  ciclo: CheckoutPayload["billing_cycle"]
): number | null {
  const value = ciclo === "yearly" ? plan.preco_anual : plan.preco_mensal;
  return value && value > 0 ? value : null;
}

/** Cartão aprovado na hora já nasce pago; PIX, boleto e cartão em análise esperam o webhook. */
export function statusInicialDoSignup(
  billingType: CheckoutPayload["billing_type"],
  statusPrimeiraCobranca: string | undefined
): "paid" | "pending" {
  return billingType === "CREDIT_CARD" &&
    (statusPrimeiraCobranca === "CONFIRMED" || statusPrimeiraCobranca === "RECEIVED")
    ? "paid"
    : "pending";
}

/** Dados da 1ª cobrança que o front usa na confirmação (o QR do PIX é somado depois, pelo index). */
export function metadataDaCobranca(
  billingType: CheckoutPayload["billing_type"],
  value: number,
  cycle: CheckoutPayload["billing_cycle"],
  primeira: AsaasPayment | null
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    billing_type: billingType,
    value,
    cycle,
    payment_id: primeira?.id ?? null,
    invoice_url: primeira?.invoiceUrl ?? null,
  };
  if (billingType === "BOLETO" && primeira) {
    metadata.boleto = {
      bank_slip_url: primeira.bankSlipUrl ?? null,
      identification_field: primeira.identificationField ?? null,
      nosso_numero: primeira.nossoNumero ?? null,
    };
  }
  return metadata;
}
