/**
 * GET /functions/v1/health
 *
 * Endpoint público (sem JWT) consumido por:
 *  - Checkly (synthetic monitoring, 1x/min)
 *  - BetterStack/UptimeRobot (status page)
 *  - Internal dashboards
 *
 * Notas:
 *  - withSentry envolve mas erros aqui são raros — todos os checks tratam exceções internamente
 *  - Sem rate limit pesado (depende do Supabase edge tier; Checkly 1x/min é OK)
 *  - Cache-Control: no-store — o ponto inteiro é status real-time
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { aggregate, checkAsaas, checkDatabase, checkResend } from "../_shared/healthcheck.ts";

const VERSION =
  Deno.env.get("RELEASE_SHA") ?? Deno.env.get("SENTRY_RELEASE") ?? Deno.env.get("VERCEL_GIT_COMMIT_SHA") ?? "unknown";

const ENABLE_ASAAS_CHECK = (Deno.env.get("HEALTH_CHECK_ASAAS") ?? "true") !== "false";
const ENABLE_RESEND_CHECK = (Deno.env.get("HEALTH_CHECK_RESEND") ?? "true") !== "false";

serve(
  withSentry("health", async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "content-type",
        },
      });
    }

    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const [db, asaas, resend] = await Promise.all([
      checkDatabase(2000),
      ENABLE_ASAAS_CHECK ? checkAsaas(3000) : Promise.resolve(undefined),
      ENABLE_RESEND_CHECK ? checkResend(3000) : Promise.resolve(undefined),
    ]);

    const { status, http } = aggregate({ db, asaas, resend });

    const checks: Record<string, string> = { db: db.status };
    const latency: Record<string, number> = { db: db.latency_ms };
    if (asaas) {
      checks.asaas = asaas.status;
      latency.asaas = asaas.latency_ms;
    }
    if (resend) {
      checks.resend = resend.status;
      latency.resend = resend.latency_ms;
    }

    const body = {
      status,
      checks,
      latency_ms: latency,
      version: VERSION,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(body), {
      status: http,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
        "Access-Control-Allow-Origin": "*",
      },
    });
  })
);
