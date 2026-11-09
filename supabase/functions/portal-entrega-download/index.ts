import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkDbRateLimit, getClientKey } from "../_shared/db-rate-limit.ts";
import { lerJson } from "../_shared/schemas.ts";
import { lerEntrada } from "./entrada.ts";

const log = createLogger("portal-entrega-download");

/**
 * Retorna signed URL de 5min para arquivo do bucket portal-entregas.
 *
 * Entrada: { session_token, entrega_id }, sessão do portal validada por
 * portal_verify_session_readonly. Valida que a entrega pertence à empresa e a um projeto
 * do cliente da sessão e gera a signed URL com SERVICE_ROLE_KEY (contorna RLS do storage).
 */
serve(
  withSentry("portal-entrega-download", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Público (verify_jwt = false), gera signed URL de download a partir de um
    // token. Sem limite, um IP consegue varrer entrega_id/token. DB-backed
    // cross-instance; 30/min cobre baixar vários arquivos numa sessão normal.
    const rl = await checkDbRateLimit(adminClient, {
      bucket: "portal_entrega_download",
      key: getClientKey(req),
      max: 30,
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
      const entrada = lerEntrada(await lerJson(req));
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
      const { entrega_id, session_token } = entrada.data;

      const anonClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

      // Verificador read-only: NÃO rotaciona o token. O portal_verify_session
      // rotaciona e devolve new_token; como este endpoint de download descartava
      // o new_token, cada download invalidava a sessão e deslogava o cliente.
      const { data, error } = await anonClient.rpc("portal_verify_session_readonly", { p_token: session_token });
      if (error || !data) return safeErrorResponse(401, "Sessão inválida", req);
      const empresa_id = (data as { empresa_id?: string }).empresa_id;
      const cliente_id = (data as { cliente_id?: string }).cliente_id;

      if (!empresa_id || !cliente_id) return safeErrorResponse(401, "Contexto sem escopo", req);

      const { data: entrega, error: entregaError } = await adminClient
        .from("portal_entregas")
        .select("id, projeto_id, empresa_id, arquivo_path, arquivo_nome")
        .eq("id", entrega_id as string)
        .single();

      if (entregaError || !entrega) return safeErrorResponse(404, "Entrega não encontrada", req);

      if (entrega.empresa_id !== empresa_id) {
        return safeErrorResponse(403, "Entrega fora do escopo", req);
      }

      // A entrega precisa pertencer a um projeto DO cliente da sessão, não só à mesma
      // empresa (evita IDOR entre clientes da mesma empresa). ACH-PORT-02.
      const { data: proj } = await adminClient
        .from("projetos")
        .select("id")
        .eq("id", entrega.projeto_id)
        .eq("cliente_id", cliente_id)
        .maybeSingle();
      if (!proj) return safeErrorResponse(403, "Entrega fora do seu acesso", req);

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
