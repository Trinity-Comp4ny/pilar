/**
 * GET /functions/v1/health
 * GET /functions/v1/health?componente=<api|banco|autenticacao|pagamentos|emails|ia|crons>
 *
 * Endpoint público (sem JWT) consumido por:
 *  - monitor de produção (tests/synthetic, GitHub Actions)
 *  - Sentry Uptime e Better Stack (status page, um monitor por componente)
 *
 * Saúde por componente (SPEC 105): além de alcance (banco, auth, Asaas, Resend), olha o
 * que aconteceu de fato na última hora (e-mails, webhooks de pagamento, IA) e nas
 * últimas 24 h (crons), via public._ops_sinais_saude(). A resposta pública traz só o
 * status de cada componente, sem contagem nem dado de negócio.
 *
 * Notas:
 *  - Sem rate limit pesado (depende do Supabase edge tier)
 *  - Cache-Control: no-store, o ponto inteiro é status real-time
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import {
  avaliarSinal,
  buscarSinais,
  checkAsaas,
  checkAuth,
  checkCrons,
  checkDatabase,
  checkResend,
  type CheckStatus,
  type Componente,
  montarResposta,
  pior,
} from "../_shared/healthcheck.ts";

const VERSION =
  Deno.env.get("RELEASE_SHA") ?? Deno.env.get("SENTRY_RELEASE") ?? Deno.env.get("VERCEL_GIT_COMMIT_SHA") ?? "unknown";

const ENABLE_ASAAS_CHECK = (Deno.env.get("HEALTH_CHECK_ASAAS") ?? "true") !== "false";
const ENABLE_RESEND_CHECK = (Deno.env.get("HEALTH_CHECK_RESEND") ?? "true") !== "false";

// Falhas na janela a partir das quais o componente fica degradado mesmo com sucesso
// depois. Pagamento e cron: uma basta (cliente pagou e não ativou; job diário não rodou).
const LIMITE = { pagamentos: 1, crons: 1, emails: 3, ia: 3 } as const;

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

    const [db, auth, asaas, resend, crons, sinais] = await Promise.all([
      checkDatabase(3000),
      checkAuth(3000),
      ENABLE_ASAAS_CHECK ? checkAsaas(3000) : Promise.resolve(undefined),
      ENABLE_RESEND_CHECK ? checkResend(3000) : Promise.resolve(undefined),
      checkCrons(3000),
      buscarSinais(3000),
    ]);

    const componentes: Record<Componente, CheckStatus> = {
      api: "ok", // se esta função respondeu, o runtime das Edge Functions está de pé
      banco: db.status,
      autenticacao: auth.status,
      pagamentos: pior(asaas?.status, avaliarSinal(sinais?.pagamentos, LIMITE.pagamentos)),
      emails: pior(resend?.status, avaliarSinal(sinais?.emails, LIMITE.emails)),
      ia: avaliarSinal(sinais?.ia, LIMITE.ia),
      crons: pior(crons.status, avaliarSinal(sinais?.crons, LIMITE.crons, { exigeAtividade: true })),
    };

    const componentePedido = new URL(req.url).searchParams.get("componente");
    const { http, status, erro } = montarResposta(componentes, componentePedido);

    // checks/latency_ms mantidos no formato antigo: o monitor sintético lê latency_ms.db.
    const checks: Record<string, string> = { db: db.status, auth: auth.status, crons: crons.status };
    const latency: Record<string, number> = { db: db.latency_ms, auth: auth.latency_ms, crons: crons.latency_ms };
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
      componentes,
      ...(componentePedido !== null && { componente: componentePedido }),
      ...(erro && { error: erro }),
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
