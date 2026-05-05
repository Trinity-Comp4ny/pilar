import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templatePropostaEnvio } from "../_shared/email.ts";
import { EMAIL_RE } from "../_shared/validators.ts";
import { createLogger } from "../_shared/logger.ts";
import { getRateLimitKey, RateLimiter } from "../_shared/rate-limiter.ts";

const log = createLogger("send-proposta-email");

const MAX_MESSAGE_LEN = 5_000;
const MAX_ATTACHMENT_B64 = 15 * 1024 * 1024; // ~11 MB decoded

// 10 emails por usuário por minuto
const limiter = new RateLimiter(10, 60_000);

serve(
  withSentry("send-proposta-email", async (req) => {
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

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    try {
      const { email, subject, mensagem, attachment_base64, filename, proposta_id, nome_cliente, doc_mode } =
        await req.json();

      if (!email || !EMAIL_RE.test(String(email))) {
        return safeErrorResponse(400, "Email inválido", req);
      }
      if (!subject?.trim()) {
        return safeErrorResponse(400, "Assunto obrigatório", req);
      }
      if (!attachment_base64 || typeof attachment_base64 !== "string") {
        return safeErrorResponse(400, "Documento obrigatório", req);
      }
      if (attachment_base64.length > MAX_ATTACHMENT_B64) {
        return safeErrorResponse(400, "Documento excede o tamanho máximo (10 MB)", req);
      }
      if (mensagem && mensagem.length > MAX_MESSAGE_LEN) {
        return safeErrorResponse(400, `Mensagem excede ${MAX_MESSAGE_LEN} caracteres`, req);
      }

      // Buscar nome da empresa do usuário autenticado
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id", undefined, {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      });
      const { data: empresa } = await supabase.from("empresas").select("nome").eq("id", empresaId).single();

      const empresaNome = empresa?.nome ?? "Pilar";

      await sendEmail({
        to: email,
        subject: subject.trim(),
        html: templatePropostaEnvio({
          nomeCliente: nome_cliente ?? "Cliente",
          tituloProposta: subject.trim(),
          empresaNome,
          mensagem: mensagem?.trim() || undefined,
        }),
        attachments: [{ filename: filename ?? "proposta.docx", content: attachment_base64 }],
      });

      // Atualizar proposta após envio
      if (proposta_id) {
        if (doc_mode === "contrato") {
          await supabase
            .from("propostas")
            .update({ contrato_enviado: true } as never)
            .eq("id", proposta_id);
        } else {
          await supabase.from("propostas").update({ status: "enviada" }).eq("id", proposta_id).eq("status", "rascunho");
        }
      }

      return jsonResponse({ success: true }, 200, req);
    } catch (err) {
      log.error("send proposta email failed", err);
      return safeErrorResponse(500, "Erro ao enviar email", req);
    }
  })
);
