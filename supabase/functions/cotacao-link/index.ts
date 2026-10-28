import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { getClientKey, limitarOuResponder } from "../_shared/db-rate-limit.ts";
import { hashDoToken, lerEntrada, MAX_CORPO_BYTES, saidaDaConsulta } from "./entrada.ts";

const log = createLogger("cotacao-link");

// SPEC 144: o fornecedor abre o link da cotação sem login (consultar) e envia o preço (responder).
// Autorização = o token no corpo. Token inexistente, expirado, revogado ou de cotação encerrada
// respondem igual (`{ ok: false }`), para o link não servir de oráculo. O banco só guarda o hash.
serve(
  withSentry("cotacao-link", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    try {
      const bruto = await req.text();
      if (new TextEncoder().encode(bruto).length > MAX_CORPO_BYTES) {
        return safeErrorResponse(413, "Corpo grande demais", req);
      }
      let corpo: unknown = null;
      try {
        corpo = JSON.parse(bruto);
      } catch {
        corpo = null;
      }
      const entrada = lerEntrada(corpo);
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
      const e = entrada.data;

      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      const tokenHash = await hashDoToken(e.token);

      // Por IP primeiro: chute de token barra aqui, antes de qualquer consulta ao banco.
      const porIp = await limitarOuResponder(admin, req, {
        bucket: "cotacao_link_ip",
        key: getClientKey(req),
        max: 60,
        windowSeconds: 600,
      });
      if (porIp) return porIp;

      if (e.acao === "consultar") {
        const { data, error } = await admin.rpc("cotacao_link_consultar", { p_token_hash: tokenHash });
        if (error) {
          log.error("consulta falhou", error, {});
          return safeErrorResponse(500, "Não foi possível abrir a cotação", req);
        }
        return jsonResponse(saidaDaConsulta(data), 200, req);
      }

      // Resposta: poucas por link, o suficiente para corrigir um erro de digitação.
      const porLink = await limitarOuResponder(admin, req, {
        bucket: "cotacao_link_resposta",
        key: `hash:${tokenHash}`,
        max: 20,
        windowSeconds: 3600,
      });
      if (porLink) return porLink;

      const { data, error } = await admin.rpc("cotacao_link_responder", {
        p_token_hash: tokenHash,
        p_valor: e.valor,
        p_valor_parcelado: e.valor_parcelado,
        p_condicao: e.condicao_pagamento,
        p_desconto_pct: e.desconto_pct,
        p_prazo_dias: e.prazo_entrega_dias,
        p_observacoes: e.observacoes,
      });
      if (error) {
        log.error("resposta falhou", error, {});
        return safeErrorResponse(500, "Não foi possível enviar a proposta", req);
      }
      const r = (data ?? {}) as { ok?: boolean; erro?: string };
      if (r.ok === true) return jsonResponse({ ok: true }, 200, req);
      if (r.erro === "dados_invalidos") return safeErrorResponse(400, "Confira os valores informados", req);
      return jsonResponse({ ok: false }, 200, req);
    } catch (error: unknown) {
      log.error("erro inesperado", error, {});
      return safeErrorResponse(500, "Erro interno", req);
    }
  })
);
