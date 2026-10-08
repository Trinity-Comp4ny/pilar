/**
 * Primeira cobrança de uma assinatura com o cartão já tokenizado (SPEC 098
 * Fase 2B, SPEC 104). Usada em dois lugares, com a mesma regra:
 *  - trial-expiry-cron: trial vence e a empresa tinha ativado o plano;
 *  - ativar-plano: empresa assina depois do trial vencido (cobra na hora).
 *
 * Cria a assinatura no Asaas, marca `active`, tira a empresa do modo leitura,
 * grava o audit log e manda o recibo aos admins. Lança se a cobrança falhar;
 * quem chama decide o que fazer (o cron expira, o ativar-plano devolve erro).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSubscription, type CreateSubscriptionParams } from "./asaas-platform.ts";
import { sendEmail, templateAtivarPlanoRecibo } from "./email/index.ts";

export interface AssinaturaParaConverter {
  id: string;
  empresa_id: string;
  plan_id: string;
  billing_cycle: string | null;
  asaas_customer_id: string;
}

/**
 * Como o cartão chega: token salvo no "Ativar plano" (cron, fim do trial) ou
 * o cartão digitado agora (assinar com cobrança hoje). O segundo não depende
 * da tokenização, que no Asaas de produção exige liberação do gerente.
 */
export type CartaoDaCobranca =
  | { creditCardToken: string }
  | {
      creditCard: NonNullable<CreateSubscriptionParams["creditCard"]>;
      creditCardHolderInfo: NonNullable<CreateSubscriptionParams["creditCardHolderInfo"]>;
    };

export interface ConversaoResultado {
  asaasSubscriptionId: string;
  valor: number;
  planoNome: string;
}

export async function converterEmAssinaturaAtiva(
  admin: SupabaseClient,
  row: AssinaturaParaConverter,
  cartao: CartaoDaCobranca,
  opts: { appUrl: string; remoteIp?: string; origem: "trial_expirado" | "assinatura_apos_trial" }
): Promise<ConversaoResultado> {
  const { data: plan } = await admin
    .from("pilar_subscription_plans")
    .select("nome, preco_mensal, preco_anual")
    .eq("id", row.plan_id)
    .maybeSingle();
  const { data: empresa } = await admin.from("empresas").select("nome").eq("id", row.empresa_id).maybeSingle();

  const yearly = row.billing_cycle === "yearly";
  const valor = yearly ? plan?.preco_anual : plan?.preco_mensal;
  if (!plan || valor == null) {
    throw new Error("plano ou preço ausente na conversão");
  }

  const subscription = await createSubscription({
    customer: row.asaas_customer_id,
    billingType: "CREDIT_CARD",
    value: valor,
    cycle: yearly ? "YEARLY" : "MONTHLY",
    nextDueDate: new Date().toISOString().slice(0, 10),
    description: `Pilar — assinatura ${plan.nome}`,
    externalReference: row.empresa_id,
    ...cartao,
    // Cobrança do servidor (cron) não tem IP de dispositivo pra reportar.
    remoteIp: opts.remoteIp ?? "0.0.0.0",
  });

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + (yearly ? 12 : 1));

  const { error: subErr } = await admin
    .from("pilar_subscriptions")
    .update({
      status: "active",
      asaas_subscription_id: subscription.id,
      asaas_customer_id: row.asaas_customer_id,
      plan_id: row.plan_id,
      billing_cycle: row.billing_cycle,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })
    .eq("id", row.id);
  if (subErr) {
    // A cobrança já foi criada no Asaas: o webhook de pagamento reconcilia,
    // mas o erro precisa subir alto pra alguém olhar.
    throw new Error(`cobrança criada (${subscription.id}), mas falhou ao ativar a assinatura: ${subErr.message}`);
  }

  // Sai do modo leitura (SPEC 098 Fase 3) e zera os avisos de retenção.
  await admin
    .from("empresas")
    .update({ leitura_desde: null, retencao_aviso_60d_sent_at: null, retencao_aviso_85d_sent_at: null })
    .eq("id", row.empresa_id);

  await admin.from("admin_audit_logs").insert({
    actor_id: null,
    actor_email: "system@pilar",
    actor_role: "ultra_admin",
    action: "trial_converted_active",
    category: "billing",
    target_type: "subscription",
    target_id: row.id,
    target_name: row.empresa_id,
    empresa_id: row.empresa_id,
    metadata: { asaas_subscription_id: subscription.id, valor, origem: opts.origem, converted_at: now.toISOString() },
  });

  const { data: admins } = (await admin
    .from("profiles")
    .select("email")
    .eq("empresa_id", row.empresa_id)
    .in("role", ["owner", "admin", "ultra_admin"])) as { data: { email: string | null }[] | null };
  const recipients = (admins ?? []).map((p) => p.email).filter((e): e is string => !!e);
  if (recipients.length > 0) {
    await sendEmail({
      classe: "plataforma",
      tipo: "ativar_plano_recibo",
      to: recipients,
      idempotencyKey: `trial-convert-${row.id}-${subscription.id}`,
      ...templateAtivarPlanoRecibo({
        empresaNome: empresa?.nome ?? "sua empresa",
        planoNome: plan.nome,
        valor,
        billingUrl: `${opts.appUrl}/billing`,
      }),
    });
  }

  return { asaasSubscriptionId: subscription.id, valor, planoNome: plan.nome };
}
