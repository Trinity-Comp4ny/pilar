import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/ai-client.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";
import { safeEqual } from "../_shared/crypto.ts";

const log = createLogger("asaas-webhook");

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

serve(
  withSentry("asaas-webhook", async (req) => {
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

    // Token obrigatório — sem header = rejeita imediatamente
    const receivedToken = req.headers.get("asaas-access-token");
    if (!receivedToken) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Resolve empresa_id a partir do customer (asaas_customer_id no externalReference
    // ou via asaas_config para determinar o tenant antes do lookup de receita).
    // Isso evita cross-tenant: buscamos receita apenas dentro da empresa correta.
    let resolvedEmpresaId: string | null = null;

    // Tenta resolver via asaas_config (webhook_token identifica a empresa)
    const { data: configRows } = await adminClient
      .from("asaas_config")
      .select("empresa_id, webhook_token")
      .not("webhook_token", "is", null);

    if (configRows) {
      for (const cfg of configRows) {
        if (cfg.webhook_token && safeEqual(receivedToken, cfg.webhook_token)) {
          resolvedEmpresaId = cfg.empresa_id;
          break;
        }
      }
    }

    let tokenValido = resolvedEmpresaId !== null;

    // Fallback para env var global (dev/staging)
    if (!tokenValido) {
      const globalToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
      tokenValido = !!globalToken && safeEqual(receivedToken, globalToken);
    }

    if (!tokenValido) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Buscar receita pelo asaas_payment_id, restringindo ao empresa_id resolvido
    // para evitar que um webhook de uma empresa acesse receitas de outra (cross-tenant).
    let receitaQuery = adminClient
      .from("receitas")
      .select("id, empresa_id, status")
      .eq("asaas_payment_id", payment.id);

    if (resolvedEmpresaId) {
      receitaQuery = receitaQuery.eq("empresa_id", resolvedEmpresaId);
    }

    const { data: receita } = await receitaQuery.maybeSingle();

    // Registrar log (mesmo sem receita encontrada, para auditoria).
    // Idempotência: índice único em (event, payment_id) faz INSERT falhar em duplicata
    // → tratamos como noop e retornamos 200 sem reprocessar.
    const { error: logErr } = await adminClient.from("asaas_webhook_logs").insert({
      empresa_id: receita?.empresa_id ?? null,
      event,
      payment_id: payment.id,
      receita_id: receita?.id ?? null,
      payload,
    });

    if (logErr?.code === "23505") {
      return new Response("OK (duplicate, ignored)", { status: 200 });
    }

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

      const { error: updateErr } = await adminClient.from("receitas").update(updatePayload).eq("id", receita.id);
      if (updateErr) {
        log.error("falha ao atualizar receita", updateErr, { receita_id: receita.id, event });
        return new Response("Internal Server Error", { status: 500 });
      }

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
  })
);
