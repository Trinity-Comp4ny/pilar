/**
 * reuniao-analisar: analisa uma reunião colada no Ultra (SPEC 169, fase 1, colagem manual).
 *
 * Deploy: supabase functions deploy reuniao-analisar --no-verify-jwt
 *
 * Só ultra admin com MFA (requireUltraAdmin). POST { titulo, ocorreu_em, origem_nome?,
 * origem_contato?, transcript }. Redige dado pessoal, grava só o texto redigido, pede ao
 * modelo achados com citação literal e descarta o que não tem prova no texto (ADR 0050).
 * Custo e execução em ops_execucoes (agente "inteligencia"); o teto mensal pausa o agente.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { captureException, withSentry } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";
import { requireUltraAdmin } from "../_shared/admin-auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { callGeminiStructured, modeloEmUso } from "../_shared/ai-client.ts";
import { lerEntrada } from "../_shared/cerebro/entrada.ts";
import { type Dependencias, processarReuniao } from "../_shared/cerebro/processar.ts";
import { respostaSchema } from "../_shared/cerebro/prompt.ts";
import { custoUsd, estourouTeto } from "../ops-agente-run/regras.ts";

const log = createLogger("reuniao-analisar");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const AGENTE = "inteligencia";
const TIPO_IA = "ops_inteligencia";

async function gastoNoMes(admin: SupabaseClient): Promise<number> {
  const inicio = new Date();
  inicio.setUTCDate(1);
  inicio.setUTCHours(0, 0, 0, 0);
  const { data } = await admin
    .from("ops_execucoes")
    .select("custo_usd")
    .eq("agente_id", AGENTE)
    .gte("inicio", inicio.toISOString());
  return (data ?? []).reduce((s, e) => s + (Number(e.custo_usd) || 0), 0);
}

async function precoDoModelo(admin: SupabaseClient, modelo: string) {
  const { data } = await admin
    .from("ai_model_precos")
    .select("preco_input_por_milhao, preco_output_por_milhao")
    .eq("modelo", modelo)
    .lte("vigente_desde", new Date().toISOString())
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? {
        preco_input_por_milhao: Number(data.preco_input_por_milhao),
        preco_output_por_milhao: Number(data.preco_output_por_milhao),
      }
    : null;
}

function dependencias(admin: SupabaseClient): Dependencias {
  return {
    async chamarModelo(system, user) {
      const r = await callGeminiStructured(
        { systemPrompt: system, userMessage: user, empresaId: "plataforma", tipo: TIPO_IA },
        respostaSchema,
        { maxRetries: 1 }
      );
      return { data: r.data, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida };
    },
    async criarReuniao(r) {
      const { data, error } = await admin.from("reuniao").insert(r).select("id").single();
      if (error) throw new Error("falha ao criar reunião");
      return data.id as string;
    },
    async gravarAnalise(id, l) {
      const filhos = await Promise.all([
        admin.from("reuniao_insight").insert(l.insights.map((i) => ({ ...i, reuniao_id: id }))),
        admin.from("reuniao_segmento").insert(l.segmentos.map((s) => ({ ...s, reuniao_id: id }))),
        admin.from("compromisso").insert(l.compromissos.map((c) => ({ ...c, reuniao_id: id }))),
      ]);
      if (filhos.some((f) => f.error)) throw new Error("falha ao gravar achados");
      const { error } = await admin
        .from("reuniao")
        .update({
          tipo: l.tipo,
          tipo_confianca: l.tipo_confianca,
          proximo_passo: l.proximo_passo,
          proximo_passo_em: l.proximo_passo_em,
          status: "analisada",
        })
        .eq("id", id);
      if (error) throw new Error("falha ao fechar a reunião");
    },
    async marcarFalha(id) {
      await admin.from("reuniao").update({ status: "falhou" }).eq("id", id);
    },
  };
}

serve(
  withSentry("reuniao-analisar", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405, req);

    const auth = await requireUltraAdmin(req);
    if (auth.error) return auth.error;

    const lida = lerEntrada(await req.json().catch(() => null));
    if (!lida.ok) return jsonResponse({ error: lida.erro }, 400, req);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: agente } = await admin.from("ops_agentes").select("teto_mensal_brl").eq("id", AGENTE).maybeSingle();
    if (!agente) return jsonResponse({ error: "agente inteligencia não encontrado" }, 404, req);

    const { data: exec, error: execErro } = await admin
      .from("ops_execucoes")
      .insert({ agente_id: AGENTE, gatilho: "manual", status: "rodando" })
      .select("id")
      .single();
    if (execErro) return jsonResponse({ error: "não foi possível iniciar a execução" }, 500, req);
    const execucaoId = exec.id as string;
    const fechar = (campos: Record<string, unknown>) =>
      admin
        .from("ops_execucoes")
        .update({ ...campos, fim: new Date().toISOString() })
        .eq("id", execucaoId);

    const teto = agente.teto_mensal_brl === null ? null : Number(agente.teto_mensal_brl);
    if (estourouTeto(await gastoNoMes(admin), teto)) {
      await fechar({ status: "pausada_teto", erro: "teto mensal de custo atingido" });
      return jsonResponse({ error: "O teto mensal do agente foi atingido. Aumente o teto para analisar." }, 429, req);
    }

    try {
      const r = await processarReuniao(dependencias(admin), lida.entrada, auth.userId);
      if (!r.ok) {
        await fechar({ status: "falhou", erro: r.erro });
        log.error("reunião não analisada", undefined, { reuniao_id: r.reuniao_id, erro: r.erro });
        return jsonResponse(
          { error: "A análise falhou. A reunião ficou salva como falha.", reuniao_id: r.reuniao_id },
          502,
          req
        );
      }
      const custo = custoUsd(r.tokensEntrada, r.tokensSaida, await precoDoModelo(admin, modeloEmUso(TIPO_IA)));
      await fechar({ status: "ok", tokens_in: r.tokensEntrada, tokens_out: r.tokensSaida, custo_usd: custo });
      return jsonResponse(
        {
          reuniao_id: r.reuniao_id,
          insights: r.insights,
          descartados_sem_citacao: r.descartados,
          compromissos: r.compromissos,
        },
        200,
        req
      );
    } catch (e) {
      await fechar({ status: "falhou", erro: "falha inesperada" });
      await captureException(e, { fn: "reuniao-analisar" });
      return jsonResponse({ error: "Falha inesperada na análise." }, 500, req);
    }
  })
);
