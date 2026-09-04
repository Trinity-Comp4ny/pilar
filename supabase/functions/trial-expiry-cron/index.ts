/**
 * trial-expiry-cron — processa expiração de trials e envia emails de aviso.
 *
 * Deploy: supabase functions deploy trial-expiry-cron --no-verify-jwt
 *
 * Deve ser chamada via cron com:
 *   Authorization: Bearer <SERVICE_ROLE_KEY>
 *
 * Responsabilidades:
 *  - Marca status = 'expired' em empresas cujo trial_ends_at já passou
 *  - Envia emails de aviso 7 dias, 3 dias e 1 dia antes do vencimento
 *  - Idempotente: usa colunas trial_warning_*d_sent_at para evitar duplicatas
 *  - Registra cada ação em admin_audit_logs
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { withSentry } from "../_shared/sentry.ts";
import { sendEmail, templateTrialAviso } from "../_shared/email/index.ts";

const log = createLogger("trial-expiry-cron");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const APP_URL = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://app.pilarsoft.com.br")
  .split(",")[0]
  .trim()
  .replace(/\/$/, "");

interface SubscriptionRow {
  id: string;
  empresa_id: string;
  trial_ends_at: string;
  trial_warning_7d_sent_at: string | null;
  trial_warning_3d_sent_at: string | null;
  trial_warning_1d_sent_at: string | null;
}

interface EmpresaInfo {
  nome: string;
}

interface ProfileRow {
  email: string | null;
  nome: string | null;
}

serve(
  withSentry("trial-expiry-cron", async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || token !== SERVICE_ROLE_KEY) {
      return new Response("Unauthorized", { status: 401 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let processed = 0;
    let expired = 0;
    let warned = 0;

    // ------------------------------------------------------------------
    // 1. Expirar trials vencidos
    // ------------------------------------------------------------------
    const { data: toExpire, error: expireQueryErr } = await admin
      .from("pilar_subscriptions")
      .select("id, empresa_id")
      .eq("status", "trialing")
      .lt("trial_ends_at", new Date().toISOString());

    if (expireQueryErr) {
      log.error("falha ao buscar trials vencidos", expireQueryErr);
    } else if (toExpire && toExpire.length > 0) {
      const ids = toExpire.map((r) => r.id);

      const { error: updateErr } = await admin.from("pilar_subscriptions").update({ status: "expired" }).in("id", ids);

      if (updateErr) {
        log.error("falha ao marcar trials como expired", updateErr, { count: ids.length });
      } else {
        expired = ids.length;
        log.info("trials expirados", { count: expired });

        // Audit log para cada empresa expirada
        for (const row of toExpire) {
          try {
            await admin.from("admin_audit_logs").insert({
              actor_id: null,
              actor_email: "system@pilar",
              actor_role: "ultra_admin",
              action: "trial_expired",
              category: "billing",
              target_type: "subscription",
              target_id: row.id,
              target_name: row.empresa_id,
              empresa_id: row.empresa_id,
              metadata: { expired_at: new Date().toISOString() },
            });
          } catch (auditErr) {
            log.warn("falha ao inserir audit log de expiração", { empresa_id: row.empresa_id, err: String(auditErr) });
          }
        }
      }

      processed += toExpire.length;
    }

    // ------------------------------------------------------------------
    // 2. Enviar emails de aviso: 7d, 3d, 1d
    // ------------------------------------------------------------------
    const warningWindows: Array<{
      days: number;
      column: "trial_warning_7d_sent_at" | "trial_warning_3d_sent_at" | "trial_warning_1d_sent_at";
      action: "trial_warning_sent_d7" | "trial_warning_sent_d3" | "trial_warning_sent_d1";
    }> = [
      { days: 7, column: "trial_warning_7d_sent_at", action: "trial_warning_sent_d7" },
      { days: 3, column: "trial_warning_3d_sent_at", action: "trial_warning_sent_d3" },
      { days: 1, column: "trial_warning_1d_sent_at", action: "trial_warning_sent_d1" },
    ];

    for (const window of warningWindows) {
      const now = new Date();
      // Janela: trial_ends_at entre agora+N-1d e agora+N+1d (slack de 24h para cron diária)
      const windowStart = new Date(now.getTime() + (window.days - 1) * 24 * 60 * 60 * 1000).toISOString();
      const windowEnd = new Date(now.getTime() + (window.days + 1) * 24 * 60 * 60 * 1000).toISOString();

      const { data: toWarn, error: warnQueryErr } = (await admin
        .from("pilar_subscriptions")
        .select(
          "id, empresa_id, trial_ends_at, trial_warning_7d_sent_at, trial_warning_3d_sent_at, trial_warning_1d_sent_at"
        )
        .eq("status", "trialing")
        .gte("trial_ends_at", windowStart)
        .lte("trial_ends_at", windowEnd)
        .is(window.column, null)) as { data: SubscriptionRow[] | null; error: unknown };

      if (warnQueryErr) {
        log.error(`falha ao buscar trials para aviso ${window.days}d`, warnQueryErr as Error);
        continue;
      }

      if (!toWarn || toWarn.length === 0) continue;

      for (const sub of toWarn) {
        try {
          // Buscar nome da empresa
          const { data: empresa } = (await admin
            .from("empresas")
            .select("nome")
            .eq("id", sub.empresa_id)
            .maybeSingle()) as { data: EmpresaInfo | null; error: unknown };

          const empresaNome = empresa?.nome ?? "sua empresa";

          // Buscar emails dos admins da empresa
          const { data: admins } = (await admin
            .from("profiles")
            .select("email, nome")
            .eq("empresa_id", sub.empresa_id)
            .in("role", ["admin", "ultra_admin"])
            .is("deleted_at", null)) as { data: ProfileRow[] | null; error: unknown };

          const recipients = (admins ?? []).map((p) => p.email).filter((e): e is string => !!e);

          if (recipients.length > 0) {
            const billingUrl = `${APP_URL}/billing`;
            await sendEmail({
              classe: "plataforma",
              tipo: `trial_aviso_${window.days}d`,
              to: recipients,
              idempotencyKey: `trial-${sub.id}-${window.days}d`,
              ...templateTrialAviso({ empresaNome, daysLeft: window.days, billingUrl }),
            });
          }

          // Marca coluna de sent_at para evitar reenvio
          await admin
            .from("pilar_subscriptions")
            .update({ [window.column]: new Date().toISOString() })
            .eq("id", sub.id);

          // Audit log
          await admin.from("admin_audit_logs").insert({
            actor_id: null,
            actor_email: "system@pilar",
            actor_role: "ultra_admin",
            action: window.action,
            category: "billing",
            target_type: "subscription",
            target_id: sub.id,
            target_name: sub.empresa_id,
            empresa_id: sub.empresa_id,
            metadata: {
              days_left: window.days,
              recipients,
              sent_at: new Date().toISOString(),
            },
          });

          warned++;
        } catch (err) {
          log.error(`falha ao processar aviso ${window.days}d para empresa`, err, {
            empresa_id: sub.empresa_id,
            subscription_id: sub.id,
          });
          // Falha individual não interrompe o loop
        }

        processed++;
      }
    }

    log.info("cron finalizado", { processed, expired, warned });

    return new Response(JSON.stringify({ processed, expired, warned }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  })
);
