import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";

import { authenticateUser, isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateMensagemManual } from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";
import { getRateLimitKey, RateLimiter } from "../_shared/rate-limiter.ts";

const log = createLogger("send-manual-client-email");

const MAX_SUBJECT_LEN = 200;
const MAX_MESSAGE_LEN = 10_000;

// 20 emails manuais por usuário por hora
const limiter = new RateLimiter(20, 60 * 60_000);

serve(
  withSentry("send-manual-client-email", async (req) => {
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

    try {
      const { cliente_id, subject, message } = await req.json();

      // Destinatário é sempre um cliente DA EMPRESA do caller, nunca endereço livre:
      // sem isso qualquer usuário logado mandaria texto arbitrário para qualquer
      // caixa com o remetente do Pilar.
      if (!isUUID(cliente_id)) return safeErrorResponse(400, "cliente_id inválido", req);
      if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
        return safeErrorResponse(400, "Assunto obrigatório", req);
      }
      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return safeErrorResponse(400, "Mensagem obrigatória", req);
      }
      if (subject.length > MAX_SUBJECT_LEN) {
        return safeErrorResponse(400, `Assunto excede ${MAX_SUBJECT_LEN} caracteres`, req);
      }
      if (message.length > MAX_MESSAGE_LEN) {
        return safeErrorResponse(400, `Mensagem excede ${MAX_MESSAGE_LEN} caracteres`, req);
      }

      // Empresa do caller (via JWT) assina o e-mail: remetente e reply-to.
      const { data: empresaId } = await auth.supabase.rpc("get_user_empresa_id");
      if (!empresaId) return safeErrorResponse(403, "Empresa não identificada", req);

      const { data: empresa } = await auth.supabase
        .from("empresas")
        .select("nome, email")
        .eq("id", empresaId)
        .maybeSingle();
      const empresaNome = empresa?.nome ?? "Seu escritório";
      if (!empresa?.email) {
        return safeErrorResponse(422, "Cadastre o e-mail da empresa em Configurações para enviar ao cliente", req);
      }

      // RLS do caller já restringe à empresa dele; o filtro explícito documenta a intenção.
      const { data: cliente } = await auth.supabase
        .from("clientes")
        .select("id, nome, email")
        .eq("id", cliente_id)
        .eq("empresa_id", empresaId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!cliente) return safeErrorResponse(404, "Cliente não encontrado", req);
      if (!cliente.email) return safeErrorResponse(422, "Este cliente não tem e-mail cadastrado", req);

      await sendEmail({
        classe: "escritorio",
        tipo: "mensagem_manual",
        to: cliente.email,
        empresa: { id: empresaId, nome: empresaNome, email: empresa.email },
        referencia: { tipo: "cliente", id: cliente.id },
        ...templateMensagemManual({
          assunto: subject.trim(),
          mensagem: message.trim(),
          empresaNome,
        }),
      });

      return jsonResponse({ success: true }, 200, req);
    } catch (err) {
      log.error("send manual client email failed", err);
      return safeErrorResponse(500, "Erro ao enviar email", req);
    }
  })
);
