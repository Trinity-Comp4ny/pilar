import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { limitarOuResponder } from "../_shared/db-rate-limit.ts";
import { lerJson } from "../_shared/schemas.ts";
import { BUCKET_AUDIO } from "../_shared/registro-organizar-real.ts";
import { ehDoDono, lerEntrada } from "./entrada.ts";

const log = createLogger("campo-registro-arquivos");

const VALIDADE_S = 300;

// SPEC 135 / ADR 0062: a conta de campo vê as fotos e ouve o áudio dos PRÓPRIOS registros. Não é
// usuário do Supabase, então a autorização é o token no corpo; o Storage é privado e só devolve
// URL assinada de 5 minutos. Registro de outra pessoa responde "não encontrado".
serve(
  withSentry("campo-registro-arquivos", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    try {
      const entrada = lerEntrada(await lerJson(req));
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
      const { token, registro_id } = entrada.data;

      const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

      const { data: sess, error: sessErr } = await admin.rpc("campo_verify_session", { p_token: token });
      const s = sess as { ok?: boolean; account_id?: string; obra_id?: string; must_change_senha?: boolean } | null;
      if (sessErr || !s?.ok || s.must_change_senha) return safeErrorResponse(401, "Sessão inválida", req);

      const limite = await limitarOuResponder(admin, req, {
        bucket: "campo_registro_arquivos",
        key: `conta:${s.account_id}`,
        max: 300,
        windowSeconds: 3600,
      });
      if (limite) return limite;

      const { data: reg } = await admin
        .from("obra_registro")
        .select("obra_id, autor_campo_account_id, audio_path, fotos")
        .eq("id", registro_id)
        .maybeSingle();
      // Mesma resposta para "não existe" e "é de outra pessoa": não confirma que o id existe.
      if (!reg || !ehDoDono(s, reg)) return safeErrorResponse(404, "Registro não encontrado", req);

      let audioUrl: string | null = null;
      if (reg.audio_path) {
        const { data, error } = await admin.storage.from(BUCKET_AUDIO).createSignedUrl(reg.audio_path, VALIDADE_S);
        if (error) log.error("url do áudio falhou", error, { registro_id });
        audioUrl = data?.signedUrl ?? null;
      }

      const fotos: string[] = [];
      if ((reg.fotos ?? []).length > 0) {
        const { data, error } = await admin.storage.from("obra-campo").createSignedUrls(reg.fotos, VALIDADE_S);
        if (error) log.error("urls das fotos falharam", error, { registro_id });
        const porCaminho = new Map((data ?? []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
        for (const p of reg.fotos as string[]) {
          const u = porCaminho.get(p);
          if (u) fotos.push(u);
        }
      }

      return jsonResponse({ audio_url: audioUrl, fotos }, 200, req);
    } catch (error: unknown) {
      log.error("erro inesperado", error, {});
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
