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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { cancelSubscription, updateSubscription } from "../_shared/asaas-platform.ts";

interface Payload {
  action: "update_plan" | "cancel";
  new_plan_slug?: string;
  new_cycle?: "monthly" | "yearly";
}

serve(async (req) => {
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

  const { data: profile } = await admin.from("profiles").select("empresa_id, role").eq("id", user.id).maybeSingle();

  if (!profile?.empresa_id || profile.role !== "admin") {
    return jsonResponse({ error: "Apenas admin da empresa pode gerenciar a assinatura" }, 403, req);
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400, req);
  }

  // --- Fetch subscription ---
  const { data: sub, error: subErr } = await admin
    .from("pilar_subscriptions")
    .select("id, asaas_subscription_id, plan_id, billing_cycle, status")
    .eq("empresa_id", profile.empresa_id)
    .maybeSingle();

  if (subErr || !sub) {
    return jsonResponse({ error: "Assinatura não encontrada" }, 404, req);
  }
  if (!sub.asaas_subscription_id) {
    return jsonResponse({ error: "Assinatura sem referência Asaas" }, 400, req);
  }

  // --- CANCEL ---
  if (body.action === "cancel") {
    if (sub.status === "canceled") {
      return jsonResponse({ error: "Assinatura já cancelada" }, 400, req);
    }

    try {
      await cancelSubscription(sub.asaas_subscription_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro Asaas";
      return jsonResponse({ error: `Falha ao cancelar: ${msg}` }, 502, req);
    }

    await admin
      .from("pilar_subscriptions")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
      })
      .eq("id", sub.id);

    return jsonResponse({ success: true, status: "canceled" }, 200, req);
  }

  // --- UPDATE PLAN ---
  if (body.action === "update_plan") {
    if (!body.new_plan_slug) {
      return jsonResponse({ error: "new_plan_slug obrigatório" }, 400, req);
    }

    const { data: newPlan, error: planErr } = await admin
      .from("pilar_subscription_plans")
      .select("id, slug, nome, preco_mensal, preco_anual")
      .eq("slug", body.new_plan_slug)
      .eq("ativo", true)
      .maybeSingle();

    if (planErr || !newPlan) {
      return jsonResponse({ error: "Plano não encontrado" }, 404, req);
    }

    const cycle = body.new_cycle ?? sub.billing_cycle ?? "monthly";
    const value = cycle === "yearly" ? newPlan.preco_anual : newPlan.preco_mensal;

    if (!value || value <= 0) {
      return jsonResponse({ error: "Valor do plano indisponível" }, 400, req);
    }

    try {
      await updateSubscription(sub.asaas_subscription_id, {
        value,
        cycle: cycle === "yearly" ? "YEARLY" : "MONTHLY",
        description: `Pilar ${newPlan.nome} — assinatura ${cycle === "yearly" ? "anual" : "mensal"}`,
        updatePendingPayments: true,
      });
    } catch (err) {
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
});
