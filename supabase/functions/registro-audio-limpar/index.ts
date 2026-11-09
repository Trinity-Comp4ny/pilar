/**
 * registro-audio-limpar: retenção do áudio do registro de obra (ADR 0062, BEZ-33).
 *
 * Deploy: supabase functions deploy registro-audio-limpar --no-verify-jwt
 *
 * Chamada todo dia pelo pg_cron (registro_audio_limpar_disparar) com
 *   Authorization: Bearer <CRON_SECRET>
 *
 * O banco diz o que apagar (registro_audio_para_apagar): registros com mais de 12 meses,
 * registros de uma conta de campo excluída e arquivos órfãos (registro, obra ou empresa
 * excluídos). Aqui o arquivo sai pela API do Storage e o registro ganha audio_apagado_em;
 * o texto e os campos extraídos ficam.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { withSentryCron } from "../_shared/sentry.ts";
import { cronAutorizado } from "../_shared/cron-auth.ts";
import { BUCKET_AUDIO } from "../_shared/registro-organizar-real.ts";
import { type Deps, type ItemApagar, limparAudios } from "./regras.ts";

const log = createLogger("registro-audio-limpar");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

serve(
  withSentryCron("registro-audio-limpar", "registro-audio-limpar-daily", async (req) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (!cronAutorizado(req.headers, CRON_SECRET)) return new Response("Unauthorized", { status: 401 });

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const deps: Deps = {
      async listar(limite) {
        const { data, error } = await admin.rpc("registro_audio_para_apagar", { p_limite: limite });
        if (error) throw new Error(`registro_audio_para_apagar falhou: ${error.message}`);
        return (data ?? []) as ItemApagar[];
      },
      async remover(paths) {
        const { error } = await admin.storage.from(BUCKET_AUDIO).remove(paths);
        return { erro: error ? error.message : null };
      },
      async marcarApagados(ids) {
        const { error } = await admin
          .from("obra_registro")
          .update({ audio_path: null, audio_apagado_em: new Date().toISOString() })
          .in("id", ids);
        return { erro: error ? error.message : null };
      },
    };

    try {
      const resumo = await limparAudios(deps);
      if (resumo.erro) {
        log.error("limpeza de áudio parou com erro", new Error(resumo.erro), { ...resumo });
        return new Response(JSON.stringify(resumo), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      log.info("limpeza de áudio finalizada", { ...resumo });
      return new Response(JSON.stringify(resumo), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (err) {
      log.error("falha ao limpar áudios", err);
      return new Response(JSON.stringify({ error: "limpeza falhou" }), { status: 500 });
    }
  })
);
