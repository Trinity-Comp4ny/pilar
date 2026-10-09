import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/ai-client.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";
import { atualizacaoDaReceita, autorizarToken } from "./regras.ts";

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

    // O token identifica a empresa (asaas_config.webhook_token), e a receita só é
    // buscada dentro dela: um webhook de uma empresa nunca toca receita de outra.
    const { data: configRows } = await adminClient
      .from("asaas_config")
      .select("empresa_id, webhook_token")
      .not("webhook_token", "is", null);

    const autorizacao = autorizarToken(receivedToken, configRows ?? [], Deno.env.get("ASAAS_WEBHOOK_TOKEN"));
    if (!autorizacao.valido) {
      return new Response("Unauthorized", { status: 401 });
    }
    const resolvedEmpresaId = autorizacao.empresaId;

    // Buscar receita pelo asaas_payment_id, restringindo ao empresa_id resolvido
    // para evitar que um webhook de uma empresa acesse receitas de outra (cross-tenant).
    let receitaQuery = adminClient.from("receitas").select("id, empresa_id, status").eq("asaas_payment_id", payment.id);

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

    const atualizacao = atualizacaoDaReceita(event, payment, new Date().toISOString().split("T")[0]);

    if (atualizacao) {
      const { error: updateErr } = await adminClient.from("receitas").update(atualizacao.campos).eq("id", receita.id);
      if (updateErr) {
        log.error("falha ao atualizar receita", updateErr, { receita_id: receita.id, event });
        return new Response("Internal Server Error", { status: 500 });
      }

      // Atualizar marco vinculado se recebido
      if (atualizacao.marcarMarcoRecebido) {
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
