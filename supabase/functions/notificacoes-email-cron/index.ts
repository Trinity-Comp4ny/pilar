/**
 * notificacoes-email-cron: manda por e-mail o que está na central e ninguém leu.
 *
 * Deploy: supabase functions deploy notificacoes-email-cron --no-verify-jwt
 * Chamada por pg_cron (migration 20260912000000) com o service role no header:
 *   POST { "modo": "imediato" }  a cada 5 min, severidade high/critical
 *   POST { "modo": "semanal"  }  segunda 11:00 UTC (08:00 BRT)
 * E pela rpc_notificar_mencao (migration 20261208000000), na hora da menção:
 *   POST { "modo": "mencao", "ids": [...] }  só as notificações daquela menção
 *
 * Quem recebe o quê é decidido no banco (`notificacoes_pendentes_email`), que
 * respeita a preferência de categoria e o roteamento original da notificação.
 * Esta função só agrupa, envia e marca. Ver SPEC 096 e docs/operations/EMAILS.md.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { BRAND, sendEmail, templateNotificacoes } from "../_shared/email/index.ts";
import { createLogger } from "../_shared/logger.ts";
import { recordMetric, withSentry } from "../_shared/sentry.ts";
import { agruparPorPessoa, chaveIdempotencia, type LinhaPendente } from "./agrupar.ts";
import { cronAutorizado } from "../_shared/cron-auth.ts";

const log = createLogger("notificacoes-email-cron");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Segredo próprio do cron, independente do formato que a Supabase usa hoje pra
// SUPABASE_SERVICE_ROLE_KEY (mudou de JWT pra sb_secret_... sem aviso). Ver ADR
// no commit desta mudança.
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

/** Teto por rodada. Corta por pessoa; o resto entra na próxima (nada é perdido). */
const MAX_PESSOAS_IMEDIATO = 200;
const MAX_PESSOAS_SEMANAL = 2000;

type Modo = "imediato" | "semanal" | "mencao";
const MODOS: Modo[] = ["imediato", "semanal", "mencao"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TIPO_ENVIO: Record<Modo, string> = {
  imediato: "notificacao_imediata",
  semanal: "notificacao_semanal",
  mencao: "notificacao_mencao",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

serve(
  withSentry("notificacoes-email-cron", async (req) => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    // Só o cron chama, com CRON_SECRET próprio (não o service_role_key da
    // Supabase: formato pode mudar por conta deles, isto não). Sem CORS: não é
    // chamada de browser.
    if (!cronAutorizado(req.headers, CRON_SECRET)) {
      log.warn("chamada não autorizada");
      return json({ error: "Unauthorized" }, 401);
    }

    let body: { modo?: string; ids?: unknown };
    try {
      body = (await req.json()) as { modo?: string; ids?: unknown };
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const modo = body.modo as Modo;
    if (!MODOS.includes(modo)) {
      return json({ error: "modo deve ser 'imediato', 'semanal' ou 'mencao'" }, 400);
    }

    // Menção manda só as notificações daquela menção: sem ids, não varre a base toda.
    let ids: string[] | null = null;
    if (modo === "mencao") {
      const valido =
        Array.isArray(body.ids) &&
        body.ids.length > 0 &&
        body.ids.every((i) => typeof i === "string" && UUID_RE.test(i));
      if (!valido) return json({ error: "ids deve ser uma lista de uuids" }, 400);
      ids = body.ids as string[];
    }

    if (!SUPABASE_URL) {
      log.error("SUPABASE_URL ausente");
      return json({ error: "Server misconfigured" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data, error } = await admin.rpc("notificacoes_pendentes_email", { p_modo: modo, p_ids: ids ?? undefined });
    if (error) {
      log.error("falha ao buscar pendências", error, { modo });
      return json({ error: "Query failed" }, 500);
    }

    const linhas = (data ?? []) as LinhaPendente[];
    if (linhas.length === 0) {
      log.info("nada pendente", { modo });
      return json({ success: true, modo, enviados: 0, pessoas: 0 }, 200);
    }

    const sinoUrl = `${BRAND.appUrl}/inicio`;
    const gerenciarUrl = `${BRAND.appUrl}/?abrir=preferencias-notificacao`;
    const lotes = agruparPorPessoa(linhas, {
      appUrl: BRAND.appUrl,
      sinoUrl,
      maxPessoas: modo === "semanal" ? MAX_PESSOAS_SEMANAL : MAX_PESSOAS_IMEDIATO,
    });

    let enviados = 0;
    let falhas = 0;

    for (const lote of lotes) {
      const email = templateNotificacoes({
        nome: lote.nome,
        modo,
        itens: lote.itens,
        totalOculto: lote.totalOculto,
        gerenciarUrl,
        sinoUrl,
      });

      try {
        const res = await sendEmail({
          classe: "plataforma",
          tipo: TIPO_ENVIO[modo],
          to: lote.email,
          empresa: { id: lote.empresaId, nome: BRAND.nome },
          referencia: { tipo: "notificacoes_lote" },
          idempotencyKey: await chaveIdempotencia(modo, lote),
          ...email,
        });

        // Endereço suprimido ou dry-run: marca como enviado para não tentar de novo
        // a cada 5 minutos. A linha em email_envios registra o motivo real.
        await admin
          .from("notificacoes")
          .update({ email_enviado_em: new Date().toISOString() })
          .in("id", lote.notificacaoIds);

        if (res.ok) enviados += 1;
      } catch (err) {
        // Não marca: o mesmo lote volta na próxima rodada, com a mesma
        // Idempotency-Key, então o Resend não duplica se o envio tiver saído.
        falhas += 1;
        log.error("falha ao enviar lote", err, { modo, itens: lote.itens.length });
      }
    }

    recordMetric("email.notificacao.enviados", enviados, { type: "counter", tags: { modo } });
    if (falhas > 0) recordMetric("email.notificacao.falhas", falhas, { type: "counter", tags: { modo } });

    log.info("rodada concluída", { modo, pessoas: lotes.length, enviados, falhas, linhas: linhas.length });
    return json({ success: true, modo, pessoas: lotes.length, enviados, falhas }, 200);
  })
);
