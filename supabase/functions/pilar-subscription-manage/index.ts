/**
 * pilar-subscription-manage — ações sobre a assinatura do próprio Pilar.
 *
 * Deploy: supabase functions deploy pilar-subscription-manage
 * (JWT obrigatório — só admin da empresa pode chamar)
 *
 * Actions:
 *   "update_plan" — body: { new_plan_slug, new_cycle? }
 *   "cancel"      — body: {}
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, optionsResponse, recusarAppExterno } from "../_shared/cors.ts";
import { ehAdminDaEmpresa } from "../_shared/admin-auth.ts";
import {
  cancelSubscription,
  updateSubscription,
  getSubscriptionPayments,
  refundPayment,
} from "../_shared/asaas-platform.ts";
import { createLogger } from "../_shared/logger.ts";
import { limitarOuResponder } from "../_shared/db-rate-limit.ts";
import { type Entrada, lerEntrada } from "./entrada.ts";
import {
  alteracoesDoCancelamento,
  cobrancaParaEstornar,
  dentroDoArrependimento,
  planejarTrocaDePlano,
  verificarAssinatura,
  verificarCancelamento,
} from "./gestao.ts";

const log = createLogger("pilar-subscription-manage");

serve(
  withSentry("pilar-subscription-manage", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, req);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Token obrigatório" }, 401, req);
    }

    const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // --- Auth + role ---
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();

    if (userErr || !user) {
      return jsonResponse({ error: "Não autenticado" }, 401, req);
    }
    // Token de app externo (ChatGPT, Claude) é só leitura e só pelo conector (SPEC 151).
    const appExterno = recusarAppExterno(req);
    if (appExterno) return appExterno;

    const { data: profile } = await admin.from("profiles").select("empresa_id, role").eq("id", user.id).maybeSingle();

    if (!ehAdminDaEmpresa(profile)) {
      return jsonResponse({ error: "Apenas admin da empresa pode gerenciar a assinatura" }, 403, req);
    }

    // Troca de plano e cancelamento mexem na Asaas e podem estornar: limite por empresa.
    const limite = await limitarOuResponder(admin, req, {
      bucket: "subscription_manage",
      key: `empresa:${profile.empresa_id}`,
      max: 10,
      windowSeconds: 3600,
    });
    if (limite) return limite;

    const entrada = lerEntrada(await req.json().catch(() => null));
    if (!entrada.ok) return jsonResponse({ error: entrada.error }, 400, req);
    const body: Entrada = entrada.data;

    // --- Fetch subscription ---
    const { data: subLida, error: subErr } = await admin
      .from("pilar_subscriptions")
      .select("id, asaas_subscription_id, plan_id, billing_cycle, status, current_period_start")
      .eq("empresa_id", profile.empresa_id)
      .maybeSingle();

    const verificacao = verificarAssinatura(subErr ? null : subLida);
    if (!verificacao.ok) return jsonResponse({ error: verificacao.error }, verificacao.status, req);
    const sub = verificacao.sub;

    // --- CANCEL ---
    if (body.action === "cancel") {
      const podeCancelar = verificarCancelamento(sub.status);
      if (!podeCancelar.ok) return jsonResponse({ error: podeCancelar.error }, podeCancelar.status, req);

      // SPEC 098 requisito 18: cancelamento até 7 dias após a 1ª cobrança
      // (current_period_start, gravado pelo trial-expiry-cron na conversão)
      // gera estorno integral automático, sem o admin precisar pedir.
      let refunded = false;
      if (dentroDoArrependimento(sub.current_period_start, Date.now())) {
        try {
          const primeiraCobranca = cobrancaParaEstornar(await getSubscriptionPayments(sub.asaas_subscription_id));
          if (primeiraCobranca) {
            await refundPayment(primeiraCobranca.id);
            refunded = true;
          }
        } catch (err) {
          // Não bloqueia o cancelamento por causa do estorno: loga alto e
          // segue — o suporte processa manualmente se precisar.
          log.error("falha ao estornar dentro do prazo de arrependimento", err, { subscription_id: sub.id });
        }
      }

      try {
        await cancelSubscription(sub.asaas_subscription_id);
      } catch (err) {
        log.error("asaas cancel subscription failed", err, { subscription_id: sub.id });
        const msg = err instanceof Error ? err.message : "Erro Asaas";
        return jsonResponse({ error: `Falha ao cancelar: ${msg}` }, 502, req);
      }

      await admin.from("pilar_subscriptions").update(alteracoesDoCancelamento(refunded, new Date())).eq("id", sub.id);

      return jsonResponse({ success: true, status: "canceled", refunded }, 200, req);
    }

    // --- UPDATE PLAN ---
    if (body.action === "update_plan") {
      const { data: newPlan, error: planErr } = await admin
        .from("pilar_subscription_plans")
        .select("id, slug, nome, preco_mensal, preco_anual")
        .eq("slug", body.new_plan_slug)
        .eq("ativo", true)
        .maybeSingle();

      if (planErr || !newPlan) {
        return jsonResponse({ error: "Plano não encontrado" }, 404, req);
      }

      const troca = planejarTrocaDePlano(newPlan, body.new_cycle, sub.billing_cycle);
      if (!troca.ok) return jsonResponse({ error: troca.error }, troca.status, req);
      const { cycle, value } = troca;

      try {
        await updateSubscription(sub.asaas_subscription_id, troca.asaas);
      } catch (err) {
        log.error("asaas update subscription failed", err, { subscription_id: sub.id });
        const msg = err instanceof Error ? err.message : "Erro Asaas";
        return jsonResponse({ error: `Falha ao atualizar: ${msg}` }, 502, req);
      }

      await admin
        .from("pilar_subscriptions")
        .update({
          plan_id: newPlan.id,
          billing_cycle: cycle,
        })
        .eq("id", sub.id);

      return jsonResponse(
        {
          success: true,
          plan: { slug: newPlan.slug, nome: newPlan.nome },
          billing_cycle: cycle,
          value,
        },
        200,
        req
      );
    }

    return jsonResponse({ error: "action inválida" }, 400, req);
  })
);
