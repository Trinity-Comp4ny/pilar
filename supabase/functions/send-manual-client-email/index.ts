import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";

import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateMensagemManual } from "../_shared/email/index.ts";
import { EMAIL_RE } from "../_shared/validators.ts";
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
      const { email, subject, message } = await req.json();

      if (!email || !EMAIL_RE.test(String(email))) {
        return safeErrorResponse(400, "Email inválido", req);
      }
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

      // Empresa do caller (via JWT) assina o e-mail: header, remetente e reply-to.
      const { data: empresaId } = await auth.supabase.rpc("get_user_empresa_id");
      if (!empresaId) return safeErrorResponse(403, "Empresa não identificada", req);
      const { data: empresa } = await auth.supabase
        .from("empresas")
        .select("nome, email, logo_url")
        .eq("id", empresaId)
        .maybeSingle();
      const empresaNome = empresa?.nome ?? "Seu escritório";

      await sendEmail({
        classe: "escritorio",
        tipo: "mensagem_manual",
        to: email,
        empresa: { id: empresaId, nome: empresaNome, email: empresa?.email, logo_url: empresa?.logo_url },
        ...templateMensagemManual({
          assunto: subject.trim(),
          mensagem: message.trim(),
          empresa: { nome: empresaNome, logoUrl: empresa?.logo_url },
        }),
      });

      return jsonResponse({ success: true }, 200, req);
    } catch (err) {
      log.error("send manual client email failed", err);
      return safeErrorResponse(500, "Erro ao enviar email", req);
    }
  })
);
