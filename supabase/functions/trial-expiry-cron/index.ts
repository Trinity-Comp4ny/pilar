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
import { sendEmail } from "../_shared/email.ts";

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

function trialWarningEmailHtml(params: {
  empresaNome: string;
  daysLeft: number;
  billingUrl: string;
}): string {
  const { empresaNome, daysLeft, billingUrl } = params;
  const urgency =
    daysLeft === 1
      ? "⚠️ <strong>Último dia!</strong> Seu trial expira amanhã."
      : `Seu trial expira em <strong>${daysLeft} dias</strong>.`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5F5F5">
<tr><td align="center" style="padding:48px 16px 64px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#FFFFFF;border:1px solid #E5E5E5;border-radius:16px;overflow:hidden">
  <tr><td bgcolor="#A4EC86" style="background-color:#A4EC86;height:5px;line-height:1px;font-size:1px">&nbsp;</td></tr>
  <tr><td style="padding:32px 40px 28px">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
      <tr>
        <td width="44" height="44" bgcolor="#0A0A0A" align="center" valign="middle" style="background-color:#0A0A0A;width:44px;height:44px;border-radius:10px;text-align:center;vertical-align:middle">
          <span style="color:#A4EC86;font-size:24px;font-weight:900;line-height:44px;display:inline-block;vertical-align:middle">P</span>
        </td>
        <td width="14" style="width:14px">&nbsp;</td>
        <td valign="middle">
          <span style="font-size:20px;font-weight:700;color:#0A0A0A;letter-spacing:-0.025em">Pilar</span>
          <span style="font-size:10px;font-weight:500;color:#A3A3A3;letter-spacing:0.18em;margin-left:8px;text-transform:uppercase">SOFT</span>
        </td>
      </tr>
    </table>
  </td></tr>
  <tr><td style="padding:48px 40px 44px">
    <p style="margin:0;font-size:34px;font-weight:600;color:#0A0A0A;letter-spacing:-0.025em;line-height:1.15">Seu trial está <span style="color:#0A0A0A;font-weight:600;background-color:#A4EC86;padding:2px 8px;border-radius:4px">expirando</span></p>
    <p style="margin:20px 0 0;font-size:16px;line-height:1.65;color:#404040">${urgency}</p>
    <p style="margin:12px 0 0;font-size:16px;line-height:1.65;color:#404040">A empresa <strong>${empresaNome}</strong> tem acesso ao Pilar até o fim do período de trial. Para continuar usando sem interrupção, assine um plano antes do vencimento.</p>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin-top:32px">
      <tr>
        <td align="center" valign="middle" bgcolor="#0A0A0A" style="background-color:#0A0A0A;border-radius:100px;padding:16px 40px">
          <a href="${billingUrl}" target="_blank" style="color:#FFFFFF;font-weight:700;font-size:13px;letter-spacing:0.1em;text-decoration:none;text-transform:uppercase;display:inline-block;line-height:18px">ASSINAR AGORA</a>
        </td>
      </tr>
    </table>
    <p style="margin:32px 0 0;font-size:14px;line-height:1.6;color:#737373">Dúvidas? Responda este email ou acesse nossa central de ajuda.</p>
  </td></tr>
  <tr><td bgcolor="#FAFAFA" style="background-color:#FAFAFA;padding:24px 40px;border-top:1px solid #F0F0F0">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#737373">Você recebeu este email por ser administrador da empresa ${empresaNome} no Pilar.</p>
    <span style="font-size:11px;color:#A3A3A3;letter-spacing:0.14em;text-transform:uppercase;font-weight:600">pilarsoft.com.br</span>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
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

      const { error: updateErr } = await admin
        .from("pilar_subscriptions")
        .update({ status: "expired" })
        .in("id", ids);

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

      const { data: toWarn, error: warnQueryErr } = await admin
        .from("pilar_subscriptions")
        .select("id, empresa_id, trial_ends_at, trial_warning_7d_sent_at, trial_warning_3d_sent_at, trial_warning_1d_sent_at")
        .eq("status", "trialing")
        .gte("trial_ends_at", windowStart)
        .lte("trial_ends_at", windowEnd)
        .is(window.column, null) as { data: SubscriptionRow[] | null; error: unknown };

      if (warnQueryErr) {
        log.error(`falha ao buscar trials para aviso ${window.days}d`, warnQueryErr as Error);
        continue;
      }

      if (!toWarn || toWarn.length === 0) continue;

      for (const sub of toWarn) {
        try {
          // Buscar nome da empresa
          const { data: empresa } = await admin
            .from("empresas")
            .select("nome")
            .eq("id", sub.empresa_id)
            .maybeSingle() as { data: EmpresaInfo | null; error: unknown };

          const empresaNome = empresa?.nome ?? "sua empresa";

          // Buscar emails dos admins da empresa
          const { data: admins } = await admin
            .from("profiles")
            .select("email, nome")
            .eq("empresa_id", sub.empresa_id)
            .in("role", ["admin", "ultra_admin"])
            .is("deleted_at", null) as { data: ProfileRow[] | null; error: unknown };

          const recipients = (admins ?? [])
            .map((p) => p.email)
            .filter((e): e is string => !!e);

          if (recipients.length > 0) {
            const billingUrl = `${APP_URL}/billing`;
            const html = trialWarningEmailHtml({
              empresaNome,
              daysLeft: window.days,
              billingUrl,
            });

            await sendEmail({
              to: recipients,
              subject: `Seu trial expira em ${window.days} dia${window.days > 1 ? "s" : ""} — Pilar`,
              html,
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
