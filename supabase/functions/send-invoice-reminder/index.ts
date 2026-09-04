import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { authenticateUser, isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateCobrancaDireta } from "../_shared/email/index.ts";
import { EMAIL_RE } from "../_shared/validators.ts";
import { createLogger } from "../_shared/logger.ts";
import { getRateLimitKey, RateLimiter } from "../_shared/rate-limiter.ts";

const log = createLogger("send-invoice-reminder");

// 30 cobranças por usuário por hora
const limiter = new RateLimiter(30, 60 * 60_000);

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

serve(
  withSentry("send-invoice-reminder", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;

    const key = getRateLimitKey(req, auth.user.id);
    if (!limiter.allow(key)) {
      const headers = limiter.retryAfterHeaders(key);
      return new Response(JSON.stringify({ success: false, error: "Rate limit excedido" }), {
        status: 429,
        headers: { "Content-Type": "application/json", ...headers },
      });
    }
    const { supabase: supabaseClient, user } = auth;

    try {
      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("empresa_id, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.empresa_id) return safeErrorResponse(403, "Perfil sem empresa", req);
      if (!["admin", "financeiro", "operacional"].includes(profile.role)) {
        return safeErrorResponse(403, "Sem permissão para enviar cobrança", req);
      }

      const { receita_id } = await req.json();
      if (!isUUID(receita_id)) return safeErrorResponse(400, "receita_id inválido", req);

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: receita, error: receitaError } = await supabaseAdmin
        .from("receitas")
        .select(
          "id, descricao, valor, data_vencimento, status, empresa_id, cliente_id, clientes(nome, email), empresas(nome, email, logo_url, pix_chave, pix_instrucoes)"
        )
        .eq("id", receita_id)
        .single();

      if (receitaError || !receita) return safeErrorResponse(404, "Receita não encontrada", req);

      const rec = receita as unknown as {
        id: string;
        descricao: string;
        valor: number;
        data_vencimento: string;
        status: string;
        empresa_id: string;
        clientes: { nome: string; email: string | null } | null;
        empresas: {
          nome: string;
          email: string | null;
          logo_url: string | null;
          pix_chave: string | null;
          pix_instrucoes: string | null;
        };
      };

      if (rec.empresa_id !== profile.empresa_id) return safeErrorResponse(403, "Acesso negado", req);

      const clienteEmail = rec.clientes?.email;
      if (!clienteEmail || !EMAIL_RE.test(clienteEmail)) {
        return safeErrorResponse(400, "Cliente sem email válido cadastrado", req);
      }

      const hoje = new Date().toISOString().split("T")[0];
      const vencida = rec.data_vencimento < hoje && rec.status === "Pendente";

      await sendEmail({
        classe: "escritorio",
        tipo: vencida ? "cobranca_atraso" : "cobranca_lembrete",
        to: clienteEmail,
        empresa: {
          id: rec.empresa_id,
          nome: rec.empresas.nome,
          email: rec.empresas.email,
          logo_url: rec.empresas.logo_url,
        },
        idempotencyKey: `cobranca-${rec.id}-${hoje}`,
        ...templateCobrancaDireta({
          clienteNome: rec.clientes?.nome || "Cliente",
          empresa: { nome: rec.empresas.nome, logoUrl: rec.empresas.logo_url },
          descricao: rec.descricao,
          valorFormatado: formatCurrency(Number(rec.valor)),
          dataVencimento: formatDate(rec.data_vencimento),
          vencida,
          pixChave: rec.empresas.pix_chave || undefined,
          pixInstrucoes: rec.empresas.pix_instrucoes || undefined,
        }),
      });

      return jsonResponse({ success: true, email: clienteEmail, vencida }, 200, req);
    } catch (err) {
      log.error("send invoice reminder failed", err, { user_id: user.id });
      return safeErrorResponse(
        500,
        `Erro ao enviar cobrança: ${err instanceof Error ? err.message : "desconhecido"}`,
        req
      );
    }
  })
);
