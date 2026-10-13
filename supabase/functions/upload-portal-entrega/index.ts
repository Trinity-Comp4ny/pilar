import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateUser, isUUID, jsonResponse, safeErrorResponse, optionsResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { sanitizeFilename, validateMagicBytes } from "./arquivo.ts";

const log = createLogger("upload-portal-entrega");

// Upload autenticado de arquivos ao bucket portal-entregas
// Valida magic bytes (signature) antes de enviar pro storage
// Paths: {empresa_id}/{projeto_id}/{entrega_id}/{filename}

const MAX_SIZE_BYTES = 50 * 1024 * 1024;

serve(
  withSentry("upload-portal-entrega", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase: supabaseClient, user } = auth;

    try {
      const form = await req.formData();
      const file = form.get("file");
      const projeto_id = form.get("projeto_id");
      const entrega_id = form.get("entrega_id");

      if (!(file instanceof File)) return safeErrorResponse(400, "file obrigatório", req);
      if (!isUUID(projeto_id) || !isUUID(entrega_id)) {
        return safeErrorResponse(400, "projeto_id e entrega_id obrigatórios", req);
      }

      if (file.size === 0) return safeErrorResponse(400, "arquivo vazio", req);
      if (file.size > MAX_SIZE_BYTES) return safeErrorResponse(413, "arquivo > 50 MB", req);

      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("empresa_id, role")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.empresa_id) return safeErrorResponse(403, "Sem empresa", req);
      if (!["admin", "operacional"].includes(profile.role ?? "")) {
        return safeErrorResponse(403, "Sem permissão", req);
      }

      // Valida que o projeto pertence à empresa
      const { data: projeto, error: projError } = await supabaseClient
        .from("projetos")
        .select("id, empresa_id")
        .eq("id", projeto_id)
        .single();

      if (projError || projeto?.empresa_id !== profile.empresa_id) {
        return safeErrorResponse(403, "Projeto inválido", req);
      }

      const buf = new Uint8Array(await file.arrayBuffer());
      const declaredMime = file.type || "application/octet-stream";

      if (!validateMagicBytes(buf, declaredMime)) {
        log.warn("magic bytes mismatch", {
          declared_mime: declaredMime,
          user_id: user.id,
          empresa_id: profile.empresa_id,
          projeto_id,
          entrega_id,
        });
        return safeErrorResponse(400, "Tipo de arquivo não corresponde ao conteúdo", req);
      }

      const safeName = sanitizeFilename(file.name);
      const path = `${profile.empresa_id}/${projeto_id}/${entrega_id}/${Date.now()}_${safeName}`;

      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

      const { error: upErr } = await admin.storage.from("portal-entregas").upload(path, buf, {
        contentType: declaredMime,
        upsert: false,
      });

      if (upErr) {
        log.error("upload failed", upErr, {
          empresa_id: profile.empresa_id,
          projeto_id,
          entrega_id,
          path,
        });
        return safeErrorResponse(500, "Falha ao salvar arquivo", req);
      }

      // Atualiza registro em portal_entregas
      const { error: updErr } = await supabaseClient
        .from("portal_entregas")
        .update({
          arquivo_path: path,
          arquivo_nome: safeName,
          arquivo_mime: declaredMime,
          arquivo_tamanho_bytes: file.size,
        })
        .eq("id", entrega_id)
        .eq("empresa_id", profile.empresa_id);

      if (updErr) {
        log.error("update failed", updErr, {
          empresa_id: profile.empresa_id,
          entrega_id,
          path,
        });
      }

      return jsonResponse({ success: true, path, size: file.size }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error, { user_id: user.id });
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
