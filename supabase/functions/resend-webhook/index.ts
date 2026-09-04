/**
 * resend-webhook: recebe o estado de entrega do Resend e fecha o ciclo do
 * registro de envio (SPEC 095, fase 2).
 *
 *   email.delivered          → email_envios.status = 'entregue'
 *   email.delivery_delayed   → 'atrasado'
 *   email.bounced            → 'bounce'      (+ supressão, se não for transitório)
 *   email.complained         → 'reclamacao'  (+ supressão)
 *
 * Deploy: supabase functions deploy resend-webhook --no-verify-jwt
 * Secret: RESEND_WEBHOOK_SECRET (o "whsec_..." que o Resend mostra ao criar o webhook).
 *
 * Nunca loga o corpo cru: ele traz endereço de e-mail de cliente.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { createLogger } from "../_shared/logger.ts";
import { withSentry } from "../_shared/sentry.ts";
import { destinatarioDoEvento, deveSuprimir, statusDoEvento, verifySignature, type ResendEvent } from "./svix.ts";

const log = createLogger("resend-webhook");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

serve(
  withSentry("resend-webhook", async (req) => {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await req.text();

    if (!(await verifySignature(req, body, WEBHOOK_SECRET))) {
      return json({ error: "Invalid signature" }, 401);
    }

    let evento: ResendEvent;
    try {
      evento = JSON.parse(body);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const status = statusDoEvento(evento.type);
    if (!status) {
      // Evento que não rastreamos (sent, opened, clicked): 200 para o Resend não repetir.
      return json({ success: true, ignored: evento.type }, 200);
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      log.error("env do Supabase ausente");
      return json({ error: "Server misconfigured" }, 500);
    }

    const resendId = evento.data?.email_id;
    if (!resendId) {
      log.warn("evento sem email_id", { tipo: evento.type });
      return json({ success: true, ignored: "sem email_id" }, 200);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: atualizado, error: updErr } = await admin
      .from("email_envios")
      .update({ status })
      .eq("resend_id", resendId)
      .select("id, tipo")
      .maybeSingle();

    if (updErr) {
      log.error("falha ao atualizar email_envios", updErr, { tipo: evento.type });
      return json({ error: "Update failed" }, 500);
    }

    // Envio que não conhecemos (e-mail disparado fora do módulo, ou log que falhou):
    // registra e segue. A supressão abaixo continua valendo, é o que protege o domínio.
    if (!atualizado) log.warn("evento sem envio correspondente", { tipo: evento.type });

    let suprimido = false;
    if (deveSuprimir(evento)) {
      const email = destinatarioDoEvento(evento);
      if (email) {
        const motivo = evento.type === "email.complained" ? "reclamacao" : "bounce";
        const { error: supErr } = await admin
          .from("email_supressoes")
          .upsert(
            { email, motivo, detalhe: evento.data?.bounce?.subType ?? null },
            { onConflict: "email", ignoreDuplicates: true }
          );
        if (supErr) {
          log.error("falha ao inserir supressão", supErr, { motivo });
        } else {
          suprimido = true;
          log.info("endereço suprimido", { motivo });
        }
      }
    }

    log.info("evento processado", { tipo: evento.type, status, suprimido });
    return json({ success: true, status, suprimido }, 200);
  })
);
