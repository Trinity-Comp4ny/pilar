import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("portal-aprovar-proposta");

serve(
  withSentry("portal-aprovar-proposta", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Método não permitido", req);

    try {
      const { token, projeto_id } = await req.json();

      if (!token || typeof token !== "string") return safeErrorResponse(400, "token obrigatório", req);
      if (!isUUID(projeto_id)) return safeErrorResponse(400, "projeto_id inválido", req);

      const admin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      // Valida sessão via cliente_portal_accounts
      const { data: account } = await admin
        .from("cliente_portal_accounts")
        .select("cliente_id, empresa_id")
        .eq("token_sessao", token)
        .gt("token_expira_em", new Date().toISOString())
        .eq("ativo", true)
        .single();

      if (!account) return safeErrorResponse(401, "Sessão inválida ou expirada", req);

      // Valida que o projeto pertence ao cliente/empresa
      const { data: projeto } = await admin
        .from("projetos")
        .select("id, nome, status, empresa_id, cliente_id")
        .eq("id", projeto_id)
        .eq("cliente_id", account.cliente_id)
        .eq("empresa_id", account.empresa_id)
        .is("deleted_at", null)
        .single();

      if (!projeto) return safeErrorResponse(404, "Projeto não encontrado", req);

      // Busca a proposta enviada vinculada a este projeto
      const { data: proposta } = await admin
        .from("propostas")
        .select("id, status, titulo, valor_proposto")
        .eq("projeto_id", projeto_id)
        .eq("empresa_id", account.empresa_id)
        .eq("status", "enviada")
        .is("deleted_at", null)
        .maybeSingle();

      if (!proposta) {
        return safeErrorResponse(422, "Nenhuma proposta enviada encontrada para este projeto", req);
      }

      // Aprova a proposta
      const { error: updatePropostaError } = await admin
        .from("propostas")
        .update({ status: "aceita", updated_at: new Date().toISOString() })
        .eq("id", proposta.id);

      if (updatePropostaError) {
        log.error("Erro ao atualizar proposta", updatePropostaError, {});
        return safeErrorResponse(500, "Erro ao aprovar proposta", req);
      }

      // Avança status do projeto para Planejamento
      const { error: updateProjetoError } = await admin
        .from("projetos")
        .update({ status: "Planejamento", updated_at: new Date().toISOString() })
        .eq("id", projeto_id);

      if (updateProjetoError) {
        log.error("Erro ao atualizar status do projeto", updateProjetoError, {});
        return safeErrorResponse(500, "Erro ao atualizar projeto", req);
      }

      // Registra em admin_audit_logs
      await admin.from("admin_audit_logs").insert({
        actor_id: account.cliente_id,
        actor_email: "portal@cliente",
        actor_role: "user",
        action: "portal_proposta_aprovada",
        category: "empresa",
        target_type: "proposta",
        target_id: proposta.id,
        target_name: proposta.titulo ?? projeto.nome,
        empresa_id: account.empresa_id,
        metadata: {
          projeto_id,
          proposta_id: proposta.id,
          valor_proposto: proposta.valor_proposto,
        },
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      });

      return jsonResponse({ success: true }, 200, req);
    } catch (err) {
      log.error("Erro inesperado", err, {});
      return safeErrorResponse(500, "Erro interno", req);
    }
  }),
);
