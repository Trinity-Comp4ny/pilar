import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { lerJson } from "../_shared/schemas.ts";
import { decodificarImagem, EXT, lerEntrada } from "./entrada.ts";

const log = createLogger("campo-upload-foto");

// A conta de campo NÃO é usuário do Supabase: a autorização é o token de campo no
// corpo (validado via campo_verify_session). O upload em si é service_role.
serve(
  withSentry("campo-upload-foto", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    try {
      const entrada = lerEntrada(await lerJson(req));
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
      const { token, rdo_id, image_base64, content_type } = entrada.data;

      const imagem = decodificarImagem(image_base64);
      if (!imagem.ok) return safeErrorResponse(imagem.status, imagem.erro, req);
      const { bytes } = imagem;

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Valida o token de campo → obra/empresa.
      const { data: sess, error: sessErr } = await supabaseAdmin.rpc("campo_verify_session", { p_token: token });
      const s = sess as { ok?: boolean; obra_id?: string; empresa_id?: string; must_change_senha?: boolean } | null;
      if (sessErr || !s?.ok || s.must_change_senha) return safeErrorResponse(401, "Sessão inválida", req);

      const ext = EXT[content_type];
      const path = `${s.empresa_id}/${s.obra_id}/${rdo_id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabaseAdmin.storage
        .from("obra-campo")
        .upload(path, bytes, { contentType: content_type, upsert: false });
      if (upErr) {
        log.error("upload falhou", upErr, { rdo_id });
        return safeErrorResponse(400, "Falha ao subir a foto", req);
      }

      // Registra o metadado (revalida token→obra→rdo dentro da RPC).
      const { data: reg, error: regErr } = await supabaseAdmin.rpc("_campo_registrar_foto", {
        p_token: token,
        p_rdo_id: rdo_id,
        p_path: path,
      });
      const r = reg as { ok?: boolean; erro?: string } | null;
      if (regErr || !r?.ok) {
        // Metadado falhou: remove o arquivo órfão para não vazar storage.
        await supabaseAdmin.storage.from("obra-campo").remove([path]);
        return safeErrorResponse(400, r?.erro ?? "Falha ao registrar a foto", req);
      }

      return jsonResponse({ success: true, path }, 200, req);
    } catch (error: unknown) {
      log.error("erro inesperado", error, {});
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
