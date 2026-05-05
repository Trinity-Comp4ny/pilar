import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";

import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templateMensagemManual } from "../_shared/email.ts";
import { EMAIL_RE } from "../_shared/validators.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("send-manual-client-email");

const MAX_SUBJECT_LEN = 200;
const MAX_MESSAGE_LEN = 10_000;

serve(
  withSentry("send-manual-client-email", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;

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

      await sendEmail({
        to: email,
        subject: subject.trim(),
        html: templateMensagemManual(message.trim()),
      });

      return jsonResponse({ success: true }, 200, req);
    } catch (err) {
      log.error("send manual client email failed", err);
      return safeErrorResponse(500, "Erro ao enviar email", req);
    }
  })
);
