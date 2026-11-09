/**
 * cobranca-enviar: o usuário aprova o rascunho de cobrança preparado pelo agente (SPEC 148) e o
 * e-mail sai para o cliente. É o único caminho que envia: o agente nunca manda sozinho.
 *
 * Fluxo: valida papel (quem vê dinheiro e edita o financeiro), confere que o rascunho é da
 * empresa e continua aberto, confere que a parcela segue pendente, grava a abertura editada,
 * envia, marca como enviada e refaz a fila de pendências da empresa.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateCobrancaDireta } from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";
import { getRateLimitKey, RateLimiter } from "../_shared/rate-limiter.ts";
import { lerJson } from "../_shared/schemas.ts";
import { lerEntrada } from "./entrada.ts";
import {
  erroDoEnvioPulado,
  parcelaCobravel,
  podeEnviarCobranca,
  verificarDestinos,
  verificarRascunho,
} from "./regras.ts";

const log = createLogger("cobranca-enviar");

// 30 envios por usuário por hora (mesmo teto da cobrança manual)
const limiter = new RateLimiter(30, 60 * 60_000);

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const dataBr = (iso: string) => iso.split("-").reverse().join("/");

type Cobranca = {
  id: string;
  empresa_id: string;
  receita_id: string;
  etapa: number;
  status: string;
  destinatario_email: string;
  assunto: string;
  abertura: string;
};

type Receita = {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  deleted_at: string | null;
  clientes: { nome: string } | null;
  empresas: { nome: string; email: string | null; pix_chave: string | null; pix_instrucoes: string | null };
};

serve(
  withSentry("cobranca-enviar", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase: userClient, user } = auth;

    const key = getRateLimitKey(req, user.id);
    if (!limiter.allow(key)) {
      return new Response(
        JSON.stringify({ success: false, error: "Muitos envios seguidos. Aguarde e tente de novo." }),
        {
          status: 429,
          headers: { "Content-Type": "application/json", ...limiter.retryAfterHeaders(key) },
        }
      );
    }

    try {
      // Mesma regra de cobranca_decidir: quem vê dinheiro e edita o financeiro.
      const [verDinheiro, editor] = await Promise.all([
        userClient.rpc("can_view_financeiro"),
        userClient.rpc("user_has_feature", { p_feature: "financeiro", p_min_level: "editor" }),
      ]);
      if (!podeEnviarCobranca(verDinheiro.data, editor.data)) {
        return safeErrorResponse(403, "Sem permissão para enviar cobrança", req);
      }

      const entrada = lerEntrada(await lerJson(req));
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
      const { cobranca_id, abertura } = entrada.data;

      const { data: profile } = await userClient.from("profiles").select("empresa_id").eq("id", user.id).single();
      if (!profile?.empresa_id) return safeErrorResponse(403, "Perfil sem empresa", req);

      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

      const { data: cobData } = await admin
        .from("cobrancas")
        .select("id, empresa_id, receita_id, etapa, status, destinatario_email, assunto, abertura")
        .eq("id", cobranca_id)
        .single();
      const rascunho = verificarRascunho(cobData as Cobranca | null, profile.empresa_id);
      if (!rascunho.ok) return safeErrorResponse(rascunho.status, rascunho.error, req);
      const { cobranca } = rascunho;

      const { data: recData } = await admin
        .from("receitas")
        .select(
          "id, descricao, valor, data_vencimento, status, deleted_at, clientes(nome), empresas(nome, email, pix_chave, pix_instrucoes)"
        )
        .eq("id", cobranca.receita_id)
        .single();
      const receita = recData as unknown as Receita | null;
      if (!parcelaCobravel(receita)) {
        await admin
          .from("cobrancas")
          .update({ status: "cancelada", decidida_em: new Date().toISOString() })
          .eq("id", cobranca.id);
        await admin.rpc("agente_pendencias_varrer", { p_empresa: cobranca.empresa_id });
        return safeErrorResponse(409, "A parcela já foi paga ou excluída; nada foi enviado", req);
      }

      const destinos = verificarDestinos(cobranca.destinatario_email, receita.empresas.email);
      if (!destinos.ok) return safeErrorResponse(destinos.status, destinos.error, req);

      const texto = abertura ?? cobranca.abertura;
      const vencida = receita.data_vencimento < new Date().toISOString().slice(0, 10);

      const envio = await sendEmail({
        classe: "escritorio",
        tipo: `cobranca_etapa_${cobranca.etapa}`,
        to: cobranca.destinatario_email,
        empresa: { id: cobranca.empresa_id, nome: receita.empresas.nome, email: receita.empresas.email },
        idempotencyKey: `cobranca-${cobranca.id}`,
        referencia: { tipo: "receita", id: receita.id },
        ...templateCobrancaDireta({
          clienteNome: receita.clientes?.nome || "Cliente",
          empresaNome: receita.empresas.nome,
          descricao: receita.descricao,
          valorFormatado: brl(Number(receita.valor)),
          dataVencimento: dataBr(receita.data_vencimento),
          vencida,
          pixChave: receita.empresas.pix_chave || undefined,
          pixInstrucoes: receita.empresas.pix_instrucoes || undefined,
          abertura: texto,
          assunto: cobranca.assunto,
        }),
      });
      if (!envio.ok) {
        // Nada saiu: a cobrança continua como rascunho para o usuário tentar de novo.
        const erro = erroDoEnvioPulado(envio.skipped);
        return safeErrorResponse(erro.status, erro.error, req);
      }

      await admin
        .from("cobrancas")
        .update({ status: "enviada", abertura: texto, decidida_em: new Date().toISOString(), decidida_por: user.id })
        .eq("id", cobranca.id);
      await admin.rpc("agente_pendencias_varrer", { p_empresa: cobranca.empresa_id });

      return jsonResponse({ success: true, email: cobranca.destinatario_email, etapa: cobranca.etapa }, 200, req);
    } catch (err) {
      log.error("cobranca-enviar falhou", err, { user_id: user.id });
      return safeErrorResponse(500, "Não foi possível enviar a cobrança agora. Tente de novo em instantes.", req);
    }
  })
);
