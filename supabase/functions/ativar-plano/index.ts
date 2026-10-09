/**
 * ativar-plano — SPEC 098 Fase 2B, requisitos 14-16. Tokeniza o cartão do
 * admin sem cobrar nada agora, grava o consentimento datado
 * (`consentimentos_cobranca`) e o token em `pilar_subscriptions`. O trial
 * sobe a Ouro na hora (`nivel_confianca` lê `asaas_credit_card_token`); a
 * cobrança de verdade só acontece no dia 14, pelo trial-expiry-cron, usando
 * este mesmo token — o admin não digita o cartão de novo.
 *
 * SPEC 104: com o teste já vencido (empresa em modo leitura), o mesmo fluxo
 * cobra na hora, ativa a assinatura e tira a empresa do modo leitura.
 *
 * Deploy: supabase functions deploy ativar-plano (JWT obrigatório — só admin
 * da própria empresa, mesma checagem de pilar-token-pack-create).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { ehAdminDaEmpresa } from "../_shared/admin-auth.ts";
import {
  createCustomer,
  findCustomerByCpfCnpj,
  tokenizeCreditCard,
  type TokenizeCreditCardResult,
} from "../_shared/asaas-platform.ts";
import { resolverDadosCliente } from "../_shared/asaas-customer.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkDbRateLimit, getClientKey } from "../_shared/db-rate-limit.ts";
import { parseOr400 } from "../_shared/schemas.ts";
import { converterEmAssinaturaAtiva } from "../_shared/converter-assinatura.ts";
import {
  bodySchema,
  CONSENTIMENTO_TEXTO_VERSAO,
  CONSENTIMENTO_TEXTO_VERSAO_IMEDIATA,
  ehTokenizacaoSemPermissao,
  modoEfetivo,
  primeiraCobrancaEm as dataPrimeiraCobranca,
  verificarAssinatura,
  valorDoCiclo,
  type Body,
} from "./ativacao.ts";

const log = createLogger("ativar-plano");

const APP_URL = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://app.pilarsoft.com.br")
  .split(",")[0]
  .trim()
  .replace(/\/$/, "");

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
    if (!ehAdminDaEmpresa(profile)) {
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

    // --- Empresa precisa estar em teste ou com o teste vencido: quem já
    //     converteu (active) ou cancelou não ativa de novo por aqui. ---
    const { data: subLida } = await admin
      .from("pilar_subscriptions")
      .select("id, status, trial_ends_at, asaas_customer_id")
      .eq("empresa_id", empresaId)
      .maybeSingle();

    const verificacao = verificarAssinatura(subLida);
    if (!verificacao.ok) {
      return jsonResponse({ error: verificacao.error }, verificacao.status, req);
    }
    const { sub } = verificacao;
    const modo = modoEfetivo(verificacao.modo, body.cobrar_agora);

    const { data: plan } = await admin
      .from("pilar_subscription_plans")
      .select("id, nome, preco_mensal, preco_anual, ativo")
      .eq("id", body.plan_id)
      .maybeSingle();

    if (!plan || !plan.ativo) {
      return jsonResponse({ error: "Plano não encontrado" }, 404, req);
    }

    const valor = valorDoCiclo(plan, body.billing_cycle);
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

    const remoteIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
    const primeiraCobrancaEm =
      modo === "imediata" ? new Date().toISOString().slice(0, 10) : dataPrimeiraCobranca(sub.trial_ends_at);

    // Consentimento (append-only): evidência jurídica do que o admin aceitou.
    // Falha ao gravar não desfaz a ativação, mas loga alto.
    const gravarConsentimento = async () => {
      const { error: consentErr } = await admin.from("consentimentos_cobranca").insert({
        empresa_id: empresaId,
        user_id: user.id,
        plan_id: body.plan_id,
        valor,
        primeira_cobranca_em: primeiraCobrancaEm,
        texto_versao: modo === "imediata" ? CONSENTIMENTO_TEXTO_VERSAO_IMEDIATA : CONSENTIMENTO_TEXTO_VERSAO,
      });
      if (consentErr) log.error("falha ao gravar consentimento de cobrança", { empresaId, error: consentErr.message });
    };

    // --- Cobrança hoje: assinatura com o cartão digitado, sem tokenização
    //     (mesmo caminho do checkout da landing; não depende de liberação
    //     no Asaas). A rotina é a mesma da conversão do cron. ---
    if (modo === "imediata") {
      try {
        await converterEmAssinaturaAtiva(
          admin,
          {
            id: sub.id,
            empresa_id: empresaId,
            plan_id: body.plan_id,
            billing_cycle: body.billing_cycle,
            asaas_customer_id: asaasCustomerId,
          },
          { creditCard: body.credit_card, creditCardHolderInfo: body.credit_card_holder_info },
          { appUrl: APP_URL, remoteIp, origem: "assinatura_apos_trial" }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro Asaas";
        log.error("cobrança imediata recusada", { empresaId, error: msg });
        return jsonResponse(
          {
            error: `A cobrança não foi aprovada: ${msg.replace(/^Asaas: /, "")}. Confira os dados ou use outro cartão.`,
          },
          502,
          req
        );
      }
      await gravarConsentimento();
      return jsonResponse(
        { success: true, cobrado_agora: true, plano: plan.nome, valor, primeira_cobranca_em: primeiraCobrancaEm },
        200,
        req
      );
    }

    // --- Em teste: tokeniza sem cobrar (requisito 15); a cobrança fica para
    //     o fim do teste, pelo cron. ---
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
      if (ehTokenizacaoSemPermissao(msg)) {
        // Conta Asaas sem a tokenização liberada: o front oferece pagar já.
        log.warn("tokenização não liberada na conta Asaas", { empresaId });
        return jsonResponse(
          {
            error:
              "Ainda não dá para guardar o cartão sem cobrar. Você pode assinar agora, com a primeira cobrança hoje.",
            codigo: "tokenizacao_indisponivel",
          },
          409,
          req
        );
      }
      log.error("tokenização de cartão recusada", { empresaId, error: msg });
      return jsonResponse({ error: `Não foi possível validar o cartão: ${msg.replace(/^Asaas: /, "")}` }, 502, req);
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

    await gravarConsentimento();

    return jsonResponse(
      {
        success: true,
        cobrado_agora: false,
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
