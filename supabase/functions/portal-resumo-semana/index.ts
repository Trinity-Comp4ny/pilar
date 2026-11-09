import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkDbRateLimit, getClientKey } from "../_shared/db-rate-limit.ts";
import { lerJson } from "../_shared/schemas.ts";
import { callGeminiStructured, debitarTokens, verificarTokens } from "../_shared/ai-client.ts";
import { modeloEmUso } from "../_shared/llm.ts";
import {
  DIAS_DO_RESUMO,
  limparResumo,
  mensagemResumoSemana,
  montarFonte,
  PROMPT_RESUMO_SEMANA,
  type RegistroLiberado,
  resumoSchema,
} from "../_shared/resumo-semana.ts";
import { lerEntrada } from "./entrada.ts";

const log = createLogger("portal-resumo-semana");

const AGENT_KEY = "registro-resumo-semana";
const TIPO = "registro-resumo-semana";
const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * SPEC 135, fase C (BEZ-57): resumo da semana da obra para o portal do cliente. O portal não tem
 * sessão Supabase, então a autorização é o token de sessão do portal (mesmo padrão de
 * portal-obra-fotos). O modelo recebe SÓ o texto dos registros que o gestor liberou ao cliente
 * nos últimos 7 dias. O resumo fica guardado e só é refeito quando esse conjunto muda.
 */
serve(
  withSentry("portal-resumo-semana", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const rl = await checkDbRateLimit(admin, {
      bucket: "portal_resumo_semana",
      key: getClientKey(req),
      max: 30,
      windowSeconds: 60,
    });
    if (rl.rpcError) {
      log.error("rate limit check failed, rejecting request (fail-closed)", { rpcError: rl.rpcError });
      return safeErrorResponse(503, "Serviço temporariamente indisponível", req);
    }
    if (!rl.allowed) return safeErrorResponse(429, "Muitas tentativas. Aguarde antes de tentar novamente.", req);

    try {
      const entrada = lerEntrada(await lerJson(req));
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
      const { session_token, obra_id } = entrada.data;

      const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
      const { data: session, error: sessionError } = await anon.rpc("portal_verify_session_readonly", {
        p_token: session_token,
      });
      if (sessionError || !session) return safeErrorResponse(401, "Sessão inválida", req);
      const { cliente_id, empresa_id } = session as { cliente_id?: string; empresa_id?: string };
      if (!cliente_id || !empresa_id) return safeErrorResponse(401, "Contexto sem escopo", req);

      // Mesmo gate de get_cliente_obra_detail: obra do cliente da sessão, em administração e
      // visível no portal. Não confia no obra_id que o cliente manda.
      const { data: obra } = await admin
        .from("obras")
        .select("id")
        .eq("id", obra_id)
        .eq("cliente_id", cliente_id)
        .eq("empresa_id", empresa_id)
        .eq("modelo_cobranca", "administracao")
        .eq("visivel_portal", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (!obra) return safeErrorResponse(404, "Obra não encontrada", req);

      const desde = new Date(Date.now() - (DIAS_DO_RESUMO - 1) * DIA_MS).toISOString().slice(0, 10);
      const { data: regs, error: regsError } = await admin
        .from("obra_registro")
        .select("id, data_registro, texto_organizado, texto_bruto")
        .eq("obra_id", obra.id)
        .eq("empresa_id", empresa_id)
        .eq("visivel_cliente", true)
        .eq("status", "pronto")
        .gte("data_registro", desde);
      if (regsError) {
        log.error("query de registros falhou", regsError, { empresa_id });
        return safeErrorResponse(500, "Falha ao montar o resumo", req);
      }

      const fonte = await montarFonte((regs ?? []) as RegistroLiberado[]);
      if (fonte.itens.length === 0) return jsonResponse({ resumo: null }, 200, req);

      const { data: guardado } = await admin
        .from("obra_resumo_semana")
        .select("texto, fonte_hash")
        .eq("obra_id", obra.id)
        .maybeSingle();
      if (guardado?.fonte_hash === fonte.hash) return jsonResponse({ resumo: guardado.texto }, 200, req);

      // Sem saldo de tokens da empresa, o card some (o texto antigo ficaria desatualizado).
      const saldo = await verificarTokens(admin, empresa_id, null);
      if (!saldo.ok) return jsonResponse({ resumo: null }, 200, req);

      const r = await callGeminiStructured(
        {
          systemPrompt: PROMPT_RESUMO_SEMANA,
          userMessage: mensagemResumoSemana(fonte),
          empresaId: empresa_id,
          tipo: TIPO,
        },
        resumoSchema,
        { maxRetries: 1, maxOutputTokens: 512, semRaciocinio: true }
      );
      const texto = limparResumo(r.data.resumo);

      await admin
        .from("obra_resumo_semana")
        .upsert(
          { obra_id: obra.id, empresa_id, fonte_hash: fonte.hash, texto, gerado_em: new Date().toISOString() },
          { onConflict: "obra_id" }
        );
      await debitarTokens(admin, {
        empresaId: empresa_id,
        userId: null,
        agentKey: AGENT_KEY,
        model: modeloEmUso(TIPO),
        tokensInput: r.tokensEntrada,
        tokensOutput: r.tokensSaida,
        idempotencyKey: `resumo-semana:${obra.id}:${fonte.hash}`,
        calls: 1,
      });

      return jsonResponse({ resumo: texto }, 200, req);
    } catch (error: unknown) {
      // Falha da IA não derruba o portal: o card só não aparece.
      log.error("resumo da semana falhou", error, {});
      return jsonResponse({ resumo: null }, 200, req);
    }
  })
);
