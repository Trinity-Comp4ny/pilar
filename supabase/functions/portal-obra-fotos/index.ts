import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkDbRateLimit, getClientKey } from "../_shared/db-rate-limit.ts";

const log = createLogger("portal-obra-fotos");
const MAX_FOTOS = 30;

/**
 * Spec 087: URLs assinadas (5min) das fotos do diário curado da obra, pro
 * portal do cliente — o portal não tem sessão Supabase autenticada, não pode
 * chamar storage.createSignedUrls direto como o front interno faz
 * (useObraFotos.ts). Em lote (não uma chamada por foto).
 *
 * Mesmo padrão de segurança do portal-entrega-download: valida a sessão via
 * portal_verify_session_readonly, depois revalida CADA foto contra
 * obra_rdo_foto → obras.cliente_id da própria sessão (nunca confia no
 * obra_id que o cliente manda, evita vazar foto de obra de outro cliente da
 * mesma empresa — mesma classe de proteção do ACH-PORT-02).
 */
serve(
  withSentry("portal-obra-fotos", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const rl = await checkDbRateLimit(adminClient, {
      bucket: "portal_obra_fotos",
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
      const payload = await req.json();
      const session_token: unknown = payload.session_token;
      const foto_ids: unknown = payload.foto_ids;

      if (typeof session_token !== "string" || !session_token) {
        return safeErrorResponse(400, "session_token obrigatório", req);
      }
      if (!Array.isArray(foto_ids) || foto_ids.length === 0) {
        return safeErrorResponse(400, "foto_ids obrigatório", req);
      }
      if (foto_ids.length > MAX_FOTOS || !foto_ids.every(isUUID)) {
        return safeErrorResponse(400, "foto_ids inválido", req);
      }

      const anonClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
      const { data: session, error: sessionError } = await anonClient.rpc("portal_verify_session_readonly", {
        p_token: session_token,
      });
      if (sessionError || !session) return safeErrorResponse(401, "Sessão inválida", req);
      const cliente_id = (session as { cliente_id?: string }).cliente_id;
      const empresa_id = (session as { empresa_id?: string }).empresa_id;
      if (!cliente_id || !empresa_id) return safeErrorResponse(401, "Contexto sem escopo", req);

      // Só fotos de RDO de obra do cliente da sessão, em administração e
      // visível no portal — mesmo gate de get_cliente_obra_detail.
      const { data: fotos, error: fotosError } = await adminClient
        .from("obra_rdo_foto")
        .select("id, path, obras:obra_id!inner(cliente_id, empresa_id, modelo_cobranca, visivel_portal, deleted_at)")
        .in("id", foto_ids as string[]);

      if (fotosError) {
        log.error("query de fotos falhou", fotosError, { empresa_id });
        return safeErrorResponse(500, "Falha ao buscar fotos", req);
      }

      const permitidas = (fotos ?? []).filter((f) => {
        const o = f.obras as unknown as {
          cliente_id: string | null;
          empresa_id: string;
          modelo_cobranca: string;
          visivel_portal: boolean;
          deleted_at: string | null;
        };
        return (
          o.cliente_id === cliente_id &&
          o.empresa_id === empresa_id &&
          o.modelo_cobranca === "administracao" &&
          o.visivel_portal === true &&
          o.deleted_at === null
        );
      });

      if (permitidas.length === 0) {
        return jsonResponse({ fotos: [] }, 200, req);
      }

      const { data: signed, error: signError } = await adminClient.storage.from("obra-campo").createSignedUrls(
        permitidas.map((f) => f.path),
        300
      );
      if (signError) {
        log.error("signed urls falharam", signError, { empresa_id });
        return safeErrorResponse(500, "Falha ao gerar link das fotos", req);
      }

      const urlByPath = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
      const resultado = permitidas
        .map((f) => ({ id: f.id, signed_url: urlByPath.get(f.path) }))
        .filter((f): f is { id: string; signed_url: string } => !!f.signed_url);

      return jsonResponse({ fotos: resultado }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error);
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
