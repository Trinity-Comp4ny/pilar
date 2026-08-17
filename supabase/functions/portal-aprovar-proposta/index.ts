import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkDbRateLimit, getClientKey } from "../_shared/db-rate-limit.ts";

const log = createLogger("portal-aprovar-proposta");

serve(
  withSentry("portal-aprovar-proposta", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Método não permitido", req);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Público (verify_jwt = false), ação que muda estado (aprova proposta). Sem
    // limite generoso o bastante pra um cliente real (aprova 1x), mas baixo o
    // bastante pra travar varredura de token/projeto_id. DB-backed cross-instance.
    const rl = await checkDbRateLimit(admin, {
      bucket: "portal_aprovar_proposta",
      key: getClientKey(req),
      max: 10,
      windowSeconds: 60,
    });
    if (rl.rpcError) {
      log.error("rate limit check failed — rejecting request (fail-closed)", { rpcError: rl.rpcError });
      return safeErrorResponse(503, "Serviço temporariamente indisponível", req);
    }
    if (!rl.allowed) {
      return safeErrorResponse(429, "Muitas tentativas. Aguarde antes de tentar novamente.", req);
    }

    try {
      const { token, projeto_id } = await req.json();

      if (!token || typeof token !== "string") return safeErrorResponse(400, "token obrigatório", req);
      if (!isUUID(projeto_id)) return safeErrorResponse(400, "projeto_id inválido", req);

      // Valida sessão via RPC read-only: hash do token (sha256) + expiração
      // deslizante, sem rotacionar. O token_sessao é guardado hasheado; comparar
      // o token puro direto na coluna nunca bate → 401 permanente (bug histórico).
      const { data: session } = await admin.rpc("portal_verify_session_readonly", {
        p_token: token,
      });
      const account = session as { cliente_id: string; empresa_id: string } | null;

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

      // Aprova a proposta E avança o projeto de forma ATÔMICA (uma transação).
      // Se qualquer passo falhar, a RPC faz rollback → proposta continua "enviada" → retry funciona.
      const { error: aprovarError } = await admin.rpc("portal_aprovar_proposta_atomica", {
        p_proposta_id: proposta.id,
        p_projeto_id: projeto_id,
      });

      if (aprovarError) {
        log.error("Erro ao aprovar proposta (RPC atômica)", aprovarError, {});
        return safeErrorResponse(500, "Erro ao aprovar proposta", req);
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
