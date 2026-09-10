/**
 * ativar-plano — SPEC 098 Fase 2B, requisitos 14-16. Tokeniza o cartão do
 * admin sem cobrar nada agora, grava o consentimento datado
 * (`consentimentos_cobranca`) e o token em `pilar_subscriptions`. O trial
 * sobe a Ouro na hora (`nivel_confianca` lê `asaas_credit_card_token`); a
 * cobrança de verdade só acontece no dia 14, pelo trial-expiry-cron, usando
 * este mesmo token — o admin não digita o cartão de novo.
 *
 * Deploy: supabase functions deploy ativar-plano (JWT obrigatório — só admin
 * da própria empresa, mesma checagem de pilar-token-pack-create).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import {
  createCustomer,
  findCustomerByCpfCnpj,
  tokenizeCreditCard,
  type TokenizeCreditCardResult,
} from "../_shared/asaas-platform.ts";
import { resolverDadosCliente } from "../_shared/asaas-customer.ts";
import { creditCardSchema, creditCardHolderInfoSchema } from "../_shared/asaas-card-schemas.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkDbRateLimit, getClientKey } from "../_shared/db-rate-limit.ts";
import { parseOr400, uuidSchema, z } from "../_shared/schemas.ts";

const log = createLogger("ativar-plano");

// Versão do texto de consentimento (SPEC 098 requisito 14). Bump manual
// quando a copy do passo "Ativar plano" mudar de forma relevante — é a
// evidência de qual texto o admin realmente leu, não pode vir do client.
const CONSENTIMENTO_TEXTO_VERSAO = "ativar-plano-v1";

const bodySchema = z.object({
  plan_id: uuidSchema,
  billing_cycle: z.enum(["monthly", "yearly"]),
  credit_card: creditCardSchema,
  credit_card_holder_info: creditCardHolderInfoSchema,
});

type Body = z.infer<typeof bodySchema>;

serve(
  withSentry("ativar-plano", async (req) => {
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

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return jsonResponse({ error: "Não autenticado" }, 401, req);
    }

    const { data: profile } = await admin.from("profiles").select("empresa_id, role").eq("id", user.id).maybeSingle();
    const isAdmin = profile?.role === "admin" || profile?.role === "ultra_admin";
    if (!profile?.empresa_id || !isAdmin) {
      return jsonResponse({ error: "Apenas admin da empresa pode ativar o plano" }, 403, req);
    }
    const empresaId = profile.empresa_id;

    // Requisito 16 (anti-carding): 3 tentativas por dia por empresa — na
    // prática, se a 1ª tokenização for aceita o fluxo termina, então contar
    // toda tentativa (não só recusas) já cobre "3 recusas bloqueiam 24h" sem
    // precisar de um segundo contador para falha vs sucesso.
    const rl = await checkDbRateLimit(admin, {
      bucket: "ativar_plano",
      key: getClientKey(req, empresaId),
      max: 3,
      windowSeconds: 86400,
    });
    if (rl.rpcError) {
      log.error("rate limit check failed — rejecting request (fail-closed)", { rpcError: rl.rpcError });
      return jsonResponse({ error: "Serviço temporariamente indisponível. Tente novamente em instantes." }, 503, req);
    }
    if (!rl.allowed) {
      await admin.rpc("notificar_ultra_admins", {
        p_empresa_id: empresaId,
        p_tipo: "ativar_plano_bloqueado_carding",
        p_titulo: "Ativar plano bloqueado por excesso de tentativas",
        p_mensagem: `Empresa ${empresaId} atingiu o limite de tentativas de tokenização de cartão em 24h.`,
        p_link: "/ultra-admin",
      });
      return jsonResponse(
        { error: "Muitas tentativas de ativar o plano. Tente novamente em 24h ou fale com o suporte." },
        429,
        req
      );
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonResponse({ error: "JSON inválido" }, 400, req);
    }
    const parsed = parseOr400(bodySchema, raw);
    if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400, req);
    const body: Body = parsed.data;

    // --- Empresa precisa estar em trial: Ouro por pagamento não se aplica a
    //     quem já converteu (active) nem a quem já cancelou. ---
    const { data: sub } = await admin
      .from("pilar_subscriptions")
      .select("id, status, trial_ends_at, asaas_customer_id")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    if (!sub) {
      return jsonResponse({ error: "Assinatura não encontrada" }, 404, req);
    }
    if (sub.status !== "trialing") {
      return jsonResponse({ error: "Sua empresa já não está mais em período de teste" }, 400, req);
    }
    if (!sub.trial_ends_at) {
      return jsonResponse({ error: "Trial sem data de expiração definida" }, 500, req);
    }

    const { data: plan } = await admin
      .from("pilar_subscription_plans")
      .select("id, nome, preco_mensal, preco_anual, ativo")
      .eq("id", body.plan_id)
      .maybeSingle();

    if (!plan || !plan.ativo) {
      return jsonResponse({ error: "Plano não encontrado" }, 404, req);
    }

    const valor = body.billing_cycle === "yearly" ? plan.preco_anual : plan.preco_mensal;
    if (valor == null) {
      return jsonResponse({ error: "Este plano não tem preço anual configurado" }, 400, req);
    }

    // --- Cliente Asaas (cria se a empresa nunca teve, mesmo padrão do pack de tokens) ---
    const { data: empresa } = await admin
      .from("empresas")
      .select("nome, cnpj, email")
      .eq("id", empresaId)
      .maybeSingle();

    const resolucao = resolverDadosCliente({
      holder: body.credit_card_holder_info,
      empresa,
      userEmail: user.email,
    });
    if (!resolucao.ok) {
      return jsonResponse({ error: resolucao.error }, 400, req);
    }

    let asaasCustomerId = sub.asaas_customer_id;
    if (!asaasCustomerId) {
      try {
        const existente = await findCustomerByCpfCnpj(resolucao.dados.cpfCnpj);
        const customer = existente ?? (await createCustomer({ ...resolucao.dados, externalReference: empresaId }));
        asaasCustomerId = customer.id;
      } catch (err) {
        log.error("falha ao criar cliente Asaas no ativar-plano", {
          empresaId,
          error: err instanceof Error ? err.message : String(err),
        });
        return jsonResponse({ error: "Não foi possível iniciar a ativação. Tente novamente em instantes." }, 502, req);
      }
    }

    // --- Tokeniza sem cobrar (requisito 15) ---
    const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";

    let tokenResult: TokenizeCreditCardResult;
    try {
      tokenResult = await tokenizeCreditCard({
        customer: asaasCustomerId,
        creditCard: body.credit_card,
        creditCardHolderInfo: body.credit_card_holder_info,
        remoteIp,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro Asaas";
      log.error("tokenização de cartão recusada", { empresaId, error: msg });
      return jsonResponse({ error: `Não foi possível validar o cartão: ${msg}` }, 502, req);
    }

    // --- Grava token + troca de plano (livre durante o trial) ---
    const { error: updateErr } = await admin
      .from("pilar_subscriptions")
      .update({
        asaas_customer_id: asaasCustomerId,
        asaas_credit_card_token: tokenResult.creditCardToken,
        asaas_credit_card_last4: tokenResult.creditCardNumber,
        asaas_credit_card_brand: tokenResult.creditCardBrand,
        plan_id: body.plan_id,
        billing_cycle: body.billing_cycle,
      })
      .eq("id", sub.id);

    if (updateErr) {
      log.error("falha ao salvar token na subscription", { empresaId, error: updateErr.message });
      return jsonResponse({ error: "Cartão validado, mas houve um erro ao salvar. Tente novamente." }, 500, req);
    }

    // --- Consentimento (append-only, evidência do opt-out) ---
    const primeiraCobrancaEm = sub.trial_ends_at.slice(0, 10);
    const { error: consentErr } = await admin.from("consentimentos_cobranca").insert({
      empresa_id: empresaId,
      user_id: user.id,
      plan_id: body.plan_id,
      valor,
      primeira_cobranca_em: primeiraCobrancaEm,
      texto_versao: CONSENTIMENTO_TEXTO_VERSAO,
    });
    if (consentErr) {
      // Não desfaz a ativação por isso (o cartão já está salvo e funcional);
      // loga alto porque é a evidência jurídica do opt-out.
      log.error("falha ao gravar consentimento de cobrança", { empresaId, error: consentErr.message });
    }

    return jsonResponse(
      {
        success: true,
        nivel: "ouro",
        plano: plan.nome,
        valor,
        primeira_cobranca_em: primeiraCobrancaEm,
        cartao: { last4: tokenResult.creditCardNumber, brand: tokenResult.creditCardBrand },
      },
      200,
      req
    );
  })
);
