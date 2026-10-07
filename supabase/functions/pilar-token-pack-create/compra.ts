/**
 * Regras da compra avulsa de tokens (SPEC 077/080), sem banco nem rede: catálogo de
 * preço, schema da entrada e o status inicial da compra.
 * O index.ts faz auth, Asaas e banco; separado para teste porque é regra de dinheiro.
 */
import { creditCardHolderInfoSchema, creditCardSchema } from "../_shared/asaas-card-schemas.ts";
import { z } from "../_shared/schemas.ts";

// Catálogo de tiers (SPEC 080, DECISOES.md 2026-09-01). Fonte única de preço/tokens —
// o cliente manda só o tier_id, nunca um valor. Mudar exige decisão própria (pricing),
// não só editar esta constante.
export const TIER_CATALOG = {
  starter: { tokens: 500_000, valorCentavos: 4900 },
  cresce: { tokens: 1_500_000, valorCentavos: 12900 },
  escala: { tokens: 3_000_000, valorCentavos: 22800 },
  maximo: { tokens: 6_000_000, valorCentavos: 39900 },
} as const;

export type TierId = keyof typeof TIER_CATALOG;

export const purchaseSchema = z
  .object({
    tier_id: z.enum(["starter", "cresce", "escala", "maximo"]),
    billing_type: z.enum(["CREDIT_CARD", "PIX", "BOLETO"]),
    credit_card: creditCardSchema.optional(),
    credit_card_holder_info: creditCardHolderInfoSchema.optional(),
  })
  .refine((v) => v.billing_type !== "CREDIT_CARD" || (v.credit_card && v.credit_card_holder_info), {
    message: "Dados do cartão e do titular são obrigatórios para CREDIT_CARD",
  });

export type PurchasePayload = z.infer<typeof purchaseSchema>;

/** Cartão aprovado na hora já nasce pago; o resto espera o webhook. */
export function statusInicialDaCompra(statusAsaas: string): "paid" | "pending" {
  return statusAsaas === "CONFIRMED" || statusAsaas === "RECEIVED" ? "paid" : "pending";
}
