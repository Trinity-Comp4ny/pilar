import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { sendEmail, templatePropostaEnvio } from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";
import { getRateLimitKey, RateLimiter } from "../_shared/rate-limiter.ts";
import { lerJson } from "../_shared/schemas.ts";
import { destinatarioPermitido } from "./destinatario.ts";
import { lerEntrada } from "./entrada.ts";

const log = createLogger("send-proposta-email");

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
      const entrada = lerEntrada(await lerJson(req));
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
      const { email, subject, mensagem, attachment_base64, filename, proposta_id, nome_cliente, doc_mode } =
        entrada.data;

      // Buscar a empresa do usuário autenticado (via JWT, não do corpo da request).
      // `supabase.rpc()` não aceita `headers` por chamada (isso nunca funcionou:
      // a Authorization era ignorada e a RPC sempre rodava sem auth.uid(), então
      // isto sempre devolvia null). `auth.supabase`, que authenticateUser já monta
      // com a Authorization do caller, é o client certo pra essa chamada.
      const { data: empresaId } = await auth.supabase.rpc("get_user_empresa_id");
      if (!empresaId) return safeErrorResponse(403, "Empresa não identificada", req);

      // Só quem edita Propostas envia: sem isto, qualquer usuário da empresa (até
      // um viewer) dispara e-mail com o nome do escritório.
      const { data: podeEditar } = await auth.supabase.rpc("user_has_feature", {
        p_feature: "propostas",
        p_min_level: "editor",
      });
      if (!podeEditar) return safeErrorResponse(403, "Sem permissão para enviar propostas", req);

      // O envio é de uma proposta da empresa, e o destinatário é o e-mail cadastrado
      // do cliente/lead dela. Sem isto a função vira relay de spam com a marca do
      // escritório. Se o cadastro não tem e-mail, o digitado na tela é aceito.
      if (!proposta_id) return safeErrorResponse(400, "Proposta obrigatória", req);
      const { data: proposta } = await supabase
        .from("propostas")
        .select("cliente_id, lead_id")
        .eq("id", proposta_id)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (!proposta) return safeErrorResponse(404, "Proposta não encontrada", req);
      const destinatarioId = proposta.cliente_id ?? proposta.lead_id;
      if (destinatarioId) {
        const { data: cadastro } = await supabase
          .from(proposta.cliente_id ? "clientes" : "leads")
          .select("email")
          .eq("id", destinatarioId)
          .eq("empresa_id", empresaId)
          .maybeSingle();
        if (!destinatarioPermitido(cadastro?.email, email)) {
          return safeErrorResponse(
            422,
            "O e-mail precisa ser o cadastrado do cliente. Atualize o cadastro para enviar a outro endereço.",
            req
          );
        }
      }

      const { data: empresa } = await supabase.from("empresas").select("nome, email").eq("id", empresaId).single();

      const empresaNome = empresa?.nome ?? "Pilar";
      if (!empresa?.email)
        return safeErrorResponse(422, "Cadastre o e-mail da empresa em Configurações para enviar ao cliente", req);

      await sendEmail({
        classe: "escritorio",
        tipo: doc_mode === "contrato" ? "contrato_envio" : "proposta_envio",
        to: email,
        empresa: { id: empresaId, nome: empresaNome, email: empresa?.email },
        ...templatePropostaEnvio({
          nomeCliente: nome_cliente ?? "Cliente",
          tituloProposta: subject.trim(),
          empresaNome,
          mensagem: mensagem?.trim() || undefined,
        }),
        attachments: [{ filename: filename ?? "proposta.docx", content: attachment_base64 }],
      });

      // Atualizar proposta após envio
      if (proposta_id) {
        // Escopa o update pela empresa do caller: sem isto, um usuário da empresa A
        // forçaria status/contrato_enviado numa proposta da empresa B (roda com
        // service_role, que bypassa a RLS).
        if (doc_mode === "contrato") {
          await supabase
            .from("propostas")
            .update({ contrato_enviado: true } as never)
            .eq("id", proposta_id)
            .eq("empresa_id", empresaId);
        } else {
          await supabase
            .from("propostas")
            .update({ status: "enviada" })
            .eq("id", proposta_id)
            .eq("empresa_id", empresaId)
            .eq("status", "rascunho");
        }
      }

      return jsonResponse({ success: true }, 200, req);
    } catch (err) {
      log.error("send proposta email failed", err);
      return safeErrorResponse(500, "Erro ao enviar email", req);
    }
  })
);
