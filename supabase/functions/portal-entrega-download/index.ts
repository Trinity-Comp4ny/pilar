import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("portal-entrega-download");

/**
 * Retorna signed URL de 5min para arquivo do bucket portal-entregas.
 *
 * Aceita dois fluxos:
 *   - { token, entrega_id }           → portal público via verify_portal_token
 *   - { session_token, entrega_id }   → portal autenticado via portal_verify_session
 *
 * Em ambos, valida que entrega pertence ao projeto/empresa do contexto e
 * gera signed URL com SERVICE_ROLE_KEY (contorna RLS do storage).
 */
serve(
  withSentry("portal-entrega-download", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    try {
      const payload = await req.json();
      const entrega_id: unknown = payload.entrega_id;
      const token: unknown = payload.token;
      const session_token: unknown = payload.session_token;

      if (!isUUID(entrega_id)) return safeErrorResponse(400, "entrega_id inválido", req);
      if (!token && !session_token) return safeErrorResponse(400, "token ou session_token obrigatório", req);

      const anonClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

      let projeto_id: string | undefined;
      let empresa_id: string | undefined;

      if (typeof token === "string" && token.length > 0) {
        const { data, error } = await anonClient.rpc("verify_portal_token", { p_token: token });
        if (error || !data) return safeErrorResponse(401, "Token inválido", req);
        projeto_id = (data as { projeto_id?: string }).projeto_id;
        empresa_id = (data as { empresa_id?: string }).empresa_id;
      } else if (typeof session_token === "string" && session_token.length > 0) {
        // Verificador read-only: NÃO rotaciona o token. O portal_verify_session
        // rotaciona e devolve new_token; como este endpoint de download descartava
        // o new_token, cada download invalidava a sessão e deslogava o cliente.
        const { data, error } = await anonClient.rpc("portal_verify_session_readonly", { p_token: session_token });
        if (error || !data) return safeErrorResponse(401, "Sessão inválida", req);
        empresa_id = (data as { empresa_id?: string }).empresa_id;
      }

      if (!empresa_id) return safeErrorResponse(401, "Contexto sem escopo", req);

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { data: entrega, error: entregaError } = await adminClient
        .from("portal_entregas")
        .select("id, projeto_id, empresa_id, arquivo_path, arquivo_nome")
        .eq("id", entrega_id as string)
        .single();

      if (entregaError || !entrega) return safeErrorResponse(404, "Entrega não encontrada", req);

      if (entrega.empresa_id !== empresa_id) {
        return safeErrorResponse(403, "Entrega fora do escopo", req);
      }

      if (token && projeto_id && entrega.projeto_id !== projeto_id) {
        return safeErrorResponse(403, "Entrega fora do escopo deste portal", req);
      }

      if (!entrega.arquivo_path) return safeErrorResponse(404, "Entrega sem arquivo", req);

      const { data: signed, error: signError } = await adminClient.storage
        .from("portal-entregas")
        .createSignedUrl(entrega.arquivo_path, 300);

      if (signError || !signed?.signedUrl) {
        log.error("signed url failed", signError, { entrega_id: entrega.id, empresa_id });
        return safeErrorResponse(500, "Falha ao gerar link", req);
      }

      return jsonResponse(
        {
          signed_url: signed.signedUrl,
          arquivo_nome: entrega.arquivo_nome,
        },
        200,
        req
      );
    } catch (error: unknown) {
      log.error("unexpected error", error);
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
