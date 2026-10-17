/**
 * ops-export-funil: devolve à plataforma de marketing (repo post-automation) o funil de cada
 * link publicado, pela UTM gravada no cadastro (SPEC 128, ADR 0061).
 *
 * Deploy: supabase functions deploy ops-export-funil --no-verify-jwt
 *
 *   GET /functions/v1/ops-export-funil?desde=2026-10-01&ate=2026-10-16
 *   Authorization: Bearer <OPS_EXPORT_TOKEN>
 *
 * Resposta: { gerado_em, desde, ate, linhas: [{ dia, utm_source, utm_medium, utm_campaign,
 * utm_content, cadastros, ativados, pagantes }] }. `dia` é o dia do cadastro em Brasília;
 * ativado = criou projeto real; pagante = assinatura paga hoje. Nenhum dado pessoal sai.
 * Token próprio (não o do cron): a plataforma é outro produto e pode ser girado à parte.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";
import { cronAutorizado } from "../_shared/cron-auth.ts";
import { lerPeriodo } from "./entrada.ts";

const log = createLogger("ops-export-funil");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPS_EXPORT_TOKEN = Deno.env.get("OPS_EXPORT_TOKEN") ?? "";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

serve(
  withSentry("ops-export-funil", async (req) => {
    if (req.method !== "GET") return json({ error: "method not allowed" }, 405);
    // Mesma comparação em tempo constante do cron, com o token da integração.
    if (!cronAutorizado(req.headers, OPS_EXPORT_TOKEN)) return json({ error: "unauthorized" }, 401);

    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const periodo = lerPeriodo(new URL(req.url).searchParams, hoje);
    if (!periodo.ok) return json({ error: periodo.erro }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await admin.rpc("_ops_funil_por_utm", { p_desde: periodo.desde, p_ate: periodo.ate });
    if (error) {
      log.error("falha ao ler o funil por UTM", error);
      return json({ error: "falha ao ler o funil" }, 500);
    }

    const linhas = data ?? [];
    log.info("funil exportado", { desde: periodo.desde, ate: periodo.ate, linhas: linhas.length });
    return json({ gerado_em: new Date().toISOString(), desde: periodo.desde, ate: periodo.ate, linhas }, 200);
  })
);
