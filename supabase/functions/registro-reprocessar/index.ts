import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { limitarOuResponder } from "../_shared/db-rate-limit.ts";
import { lerJson } from "../_shared/schemas.ts";
import { emSegundoPlano } from "../_shared/segundo-plano.ts";
import { organizarRegistroReal } from "../_shared/registro-organizar-real.ts";
import { lerEntrada } from "./entrada.ts";

const log = createLogger("registro-reprocessar");

// SPEC 135: "Tentar de novo" num registro que a IA não conseguiu organizar. O escritório
// chama com o JWT dele (a RLS de obra_registro decide se o registro é da empresa); o campo
// chama com o token de campo. Nos dois casos responde 202 e reprocessa em segundo plano.
// Quem já tem o texto transcrito não paga o áudio de novo.
serve(
  withSentry("registro-reprocessar", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    try {
      const entrada = lerEntrada(await lerJson(req));
      if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
      const { registro_id, token } = entrada.data;

      const url = Deno.env.get("SUPABASE_URL") ?? "";
      const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

      let permitido = false;
      if (token) {
        const { data: sess, error } = await admin.rpc("campo_verify_session", { p_token: token });
        const s = sess as { ok?: boolean; obra_id?: string; must_change_senha?: boolean } | null;
        if (error || !s?.ok || s.must_change_senha) return safeErrorResponse(401, "Sessão inválida", req);
        const { data: reg } = await admin.from("obra_registro").select("obra_id").eq("id", registro_id).maybeSingle();
        permitido = reg?.obra_id === s.obra_id;
      } else {
        const auth = req.headers.get("Authorization");
        if (!auth) return safeErrorResponse(401, "Não autenticado", req);
        const comoUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
          global: { headers: { Authorization: auth } },
        });
        const { data: u, error } = await comoUsuario.auth.getUser();
        if (error || !u.user) return safeErrorResponse(401, "Não autenticado", req);
        // A RLS só devolve o registro se for da empresa do usuário.
        const { data: reg } = await comoUsuario.from("obra_registro").select("id").eq("id", registro_id).maybeSingle();
        permitido = Boolean(reg);
      }
      // Mesma resposta para "não existe" e "é de outra empresa": não confirma que o id existe.
      if (!permitido) return safeErrorResponse(404, "Registro não encontrado", req);

      const limite = await limitarOuResponder(admin, req, {
        bucket: "registro_reprocessar",
        key: `registro:${registro_id}`,
        max: 6,
        windowSeconds: 3600,
      });
      if (limite) return limite;

      emSegundoPlano(organizarRegistroReal(admin, registro_id), (err) =>
        log.error("reprocesso do registro falhou", err, { registro_id })
      );
      return jsonResponse({ success: true }, 202, req);
    } catch (error: unknown) {
      log.error("erro inesperado", error, {});
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
