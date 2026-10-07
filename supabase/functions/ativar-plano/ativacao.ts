/**
 * Regras do ativar-plano (SPEC 098 Fase 2B), sem banco nem rede: entrada aceita,
 * quem pode ativar, quanto vai ser cobrado e quando. O index.ts faz auth, Asaas e
 * banco; separado para teste porque o consentimento é evidência jurídica do opt-out.
 */
import { creditCardHolderInfoSchema, creditCardSchema } from "../_shared/asaas-card-schemas.ts";
import { uuidSchema, z } from "../_shared/schemas.ts";

// Versão do texto de consentimento (SPEC 098 requisito 14). Bump manual
// quando a copy do passo "Ativar plano" mudar de forma relevante — é a
// evidência de qual texto o admin realmente leu, não pode vir do client.
export const CONSENTIMENTO_TEXTO_VERSAO = "ativar-plano-v1";

export const bodySchema = z.object({
  plan_id: uuidSchema,
  billing_cycle: z.enum(["monthly", "yearly"]),
  credit_card: creditCardSchema,
  credit_card_holder_info: creditCardHolderInfoSchema,
});

export type Body = z.infer<typeof bodySchema>;

interface AssinaturaLida {
  id: string;
  status: string;
  trial_ends_at: string | null;
  asaas_customer_id: string | null;
}

export type VerificacaoAssinatura =
  { ok: true; sub: AssinaturaLida & { trial_ends_at: string } } | { ok: false; status: number; error: string };

/**
 * Ouro por pagamento só vale para quem está em trial: quem já converteu (active)
 * ou cancelou não ativa de novo por aqui.
 */
export function verificarAssinatura(sub: AssinaturaLida | null): VerificacaoAssinatura {
  if (!sub) return { ok: false, status: 404, error: "Assinatura não encontrada" };
  if (sub.status !== "trialing") {
    return { ok: false, status: 400, error: "Sua empresa já não está mais em período de teste" };
  }
  if (!sub.trial_ends_at) return { ok: false, status: 500, error: "Trial sem data de expiração definida" };
  return { ok: true, sub: { ...sub, trial_ends_at: sub.trial_ends_at } };
}

/** Valor do ciclo escolhido, sempre do plano no banco. null = plano sem preço nesse ciclo. */
export function valorDoCiclo(
  plan: { preco_mensal: number | null; preco_anual: number | null },
  ciclo: Body["billing_cycle"]
): number | null {
  return (ciclo === "yearly" ? plan.preco_anual : plan.preco_mensal) ?? null;
}

/** A primeira cobrança acontece no fim do trial (data, sem hora). */
export function primeiraCobrancaEm(trialEndsAt: string): string {
  return trialEndsAt.slice(0, 10);
}
