import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/ai-client.ts";

// IMPORTANTE: Esta função deve ser deployada com --no-verify-jwt
// pois é chamada diretamente pelo Asaas (sem JWT de usuário).
// Comando: supabase functions deploy asaas-webhook --no-verify-jwt

interface AsaasPaymentEvent {
  event: string;
  payment: {
    id: string;
    status: string;
    value: number;
    dueDate: string;
    paymentDate?: string;
    externalReference?: string;
    billingType: string;
  };
}

const STATUS_MAP: Record<string, string | null> = {
  PAYMENT_RECEIVED: "Recebido",
  PAYMENT_CONFIRMED: "Recebido",
  PAYMENT_RECEIVED_IN_CASH: "Recebido",
  PAYMENT_OVERDUE: "Atrasado",
  PAYMENT_DELETED: null,
  PAYMENT_REFUNDED: null,
  PAYMENT_AWAITING_RISK_ANALYSIS: null,
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const adminClient = createAdminClient();

  let payload: AsaasPaymentEvent;
  try {
    payload = (await req.json()) as AsaasPaymentEvent;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { event, payment } = payload;

  if (!payment?.id) {
    return new Response("OK", { status: 200 });
  }

  // Buscar receita pelo asaas_payment_id
  const { data: receita } = await adminClient
    .from("receitas")
    .select("id, empresa_id, status")
    .eq("asaas_payment_id", payment.id)
    .maybeSingle();

  // Validação do token por empresa (multi-tenant)
  // Feita após lookup da receita para identificar qual empresa está sendo notificada.
  // Em dev, o env var ASAAS_WEBHOOK_TOKEN serve como fallback global.
  const receivedToken = req.headers.get("asaas-access-token");
  if (receivedToken) {
    let tokenValido = false;

    if (receita?.empresa_id) {
      const { data: config } = await adminClient
        .from("asaas_config")
        .select("webhook_token")
        .eq("empresa_id", receita.empresa_id)
        .maybeSingle();

      tokenValido = !!config?.webhook_token && receivedToken === config.webhook_token;
    }

    // Fallback para env var global (dev/staging)
    if (!tokenValido) {
      const globalToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
      tokenValido = !!globalToken && receivedToken === globalToken;
    }

    if (!tokenValido) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // Registrar log (mesmo sem receita encontrada, para auditoria)
  await adminClient.from("asaas_webhook_logs").insert({
    empresa_id: receita?.empresa_id ?? null,
    event,
    payment_id: payment.id,
    receita_id: receita?.id ?? null,
    payload,
  });

  if (!receita) {
    return new Response("OK", { status: 200 });
  }

  const novoStatus = STATUS_MAP[event];

  if (novoStatus !== undefined) {
    const updatePayload: Record<string, unknown> = {
      asaas_payment_status: payment.status,
    };

    if (novoStatus !== null) {
      updatePayload.status = novoStatus;
    }

    if (novoStatus === "Recebido") {
      updatePayload.data_recebimento = payment.paymentDate ?? new Date().toISOString().split("T")[0];
    }

    await adminClient.from("receitas").update(updatePayload).eq("id", receita.id);

    // Atualizar marco vinculado se recebido
    if (novoStatus === "Recebido") {
      await adminClient
        .from("marcos_faturamento")
        .update({ status: "recebido" })
        .eq("receita_id", receita.id)
        .eq("status", "faturado");
    }
  }

  return new Response("OK", { status: 200 });
});
