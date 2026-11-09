/**
 * feedback-sync: o GitHub Actions move o status do feedback conforme o commit avança (SPEC 145).
 *
 * Deploy: supabase functions deploy feedback-sync --no-verify-jwt
 *
 *   POST /functions/v1/feedback-sync
 *   Authorization: Bearer <FEEDBACK_SYNC_TOKEN>
 *   { "ids": ["<uuid>"], "alvo": "planejado" | "resolvido" }
 *
 * Resposta: { atualizados: string[], ignorados: string[] }. Só avança: `resolvido` e `descartado`
 * nunca mudam, então repetir a chamada é seguro. Token próprio (não o do cron), girado à parte.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";
import { cronAutorizado } from "../_shared/cron-auth.ts";
import { lerEntrada, PARTIDAS } from "./entrada.ts";

const log = createLogger("feedback-sync");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FEEDBACK_SYNC_TOKEN = Deno.env.get("FEEDBACK_SYNC_TOKEN") ?? "";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

serve(
  withSentry("feedback-sync", async (req) => {
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
    if (!cronAutorizado(req.headers, FEEDBACK_SYNC_TOKEN)) return json({ error: "unauthorized" }, 401);

    const entrada = lerEntrada(await req.json().catch(() => null));
    if (!entrada.ok) return json({ error: entrada.erro }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await admin
      .from("feature_suggestions")
      .update({ status_interno: entrada.alvo })
      .in("id", entrada.ids)
      .in("status_interno", PARTIDAS[entrada.alvo])
      .select("id");
    if (error) {
      log.error("falha ao atualizar o status do feedback", error);
      return json({ error: "falha ao atualizar" }, 500);
    }

    const atualizados = (data ?? []).map((r) => r.id as string);
    const ignorados = entrada.ids.filter((id) => !atualizados.includes(id));
    log.info("feedback sincronizado", {
      alvo: entrada.alvo,
      atualizados: atualizados.length,
      ignorados: ignorados.length,
    });
    return json({ atualizados, ignorados }, 200);
  })
);
