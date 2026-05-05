/**
 * pilar-checkout-status — polling público de status de pagamento.
 *
 * Deploy: supabase functions deploy pilar-checkout-status --no-verify-jwt
 *
 * Recebe checkout_session_token (assumimos que só quem iniciou o checkout o
 * tem) e retorna status atual + metadata. Usado pra PIX/boleto aguardando.
 *
 * Também consulta Asaas diretamente se status ainda = pending, pra evitar
 * depender só do webhook.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { getPayment } from "../_shared/asaas-platform.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("pilar-checkout-status");

serve(
  withSentry("pilar-checkout-status", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST" && req.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405, req);
    }

    let sessionToken: string | null = null;

    if (req.method === "GET") {
      const url = new URL(req.url);
      sessionToken = url.searchParams.get("token");
    } else {
      try {
        const body = (await req.json()) as { session_token?: string };
        sessionToken = body.session_token ?? null;
      } catch {
        return jsonResponse({ error: "JSON inválido" }, 400, req);
      }
    }

    if (!sessionToken || sessionToken.length < 20) {
      return jsonResponse({ error: "session_token inválido" }, 400, req);
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: signup, error } = await admin
      .from("pilar_pending_signups")
      .select(
        `id, email, payment_status, billing_type, billing_cycle,
       paid_at, invite_dispatched_at, activated_at,
       asaas_payment_id, payment_metadata,
       plan:pilar_subscription_plans(slug, nome)`
      )
      .eq("checkout_session_token", sessionToken)
      .maybeSingle();

    if (error || !signup) {
      return jsonResponse({ error: "Sessão não encontrada" }, 404, req);
    }

    // Consulta Asaas direto se ainda pendente e tem payment_id
    if (signup.payment_status === "pending" && signup.asaas_payment_id) {
      try {
        const asaasPayment = await getPayment(signup.asaas_payment_id);

        if (asaasPayment.status === "CONFIRMED" || asaasPayment.status === "RECEIVED") {
          await admin
            .from("pilar_pending_signups")
            .update({
              payment_status: "paid",
              paid_at: asaasPayment.paymentDate
                ? new Date(asaasPayment.paymentDate).toISOString()
                : new Date().toISOString(),
            })
            .eq("id", signup.id);

          signup.payment_status = "paid";
        }
      } catch (err) {
        log.warn("asaas payment check failed", {
          signup_id: signup.id,
          payment_id: signup.asaas_payment_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return jsonResponse(
      {
        payment_status: signup.payment_status,
        billing_type: signup.billing_type,
        billing_cycle: signup.billing_cycle,
        paid_at: signup.paid_at,
        invite_dispatched: !!signup.invite_dispatched_at,
        activated: !!signup.activated_at,
        email: signup.email,
        plan: signup.plan,
        metadata: signup.payment_metadata,
      },
      200,
      req
    );
  })
);
