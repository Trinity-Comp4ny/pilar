/**
 * trial-expiry-cron — processa expiração de trials e envia emails de aviso.
 *
 * Deploy: supabase functions deploy trial-expiry-cron --no-verify-jwt
 *
 * Deve ser chamada via cron com:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Responsabilidades:
 *  - Converte em assinatura ativa quem ativou o plano (cartão tokenizado)
 *  - Marca status = 'expired' (modo leitura) nos demais e avisa por e-mail
 *  - Envia avisos 7 dias e 1 dia antes do vencimento (janelas em avisos.ts)
 *  - Roda de hora em hora (SPEC 104): o trial é de 3 dias
 *  - Idempotente: usa colunas trial_warning_*d_sent_at para evitar duplicatas
 *  - Registra cada ação em admin_audit_logs
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { withSentryCron } from "../_shared/sentry.ts";
import { sendEmail, templateTrialAviso, templateTrialExpirado } from "../_shared/email/index.ts";
import { converterEmAssinaturaAtiva } from "../_shared/converter-assinatura.ts";
import { JANELAS_DE_AVISO, limitesDaJanela } from "./avisos.ts";

const log = createLogger("trial-expiry-cron");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
// Segredo próprio do cron: ver notificacoes-email-cron/index.ts.
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const APP_URL = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://app.pilarsoft.com.br")
  .split(",")[0]
  .trim()
  .replace(/\/$/, "");

interface SubscriptionRow {
  id: string;
  empresa_id: string;
  trial_ends_at: string;
}

interface EmpresaInfo {
  nome: string;
}

// Admins da empresa que recebem e-mail de cobrança. profiles não tem
// deleted_at: filtrar por essa coluna fazia o PostgREST devolver erro e a
// lista vir vazia, então nenhum aviso de trial saía.
async function emailsDosAdmins(admin: SupabaseClient, empresaId: string): Promise<string[]> {
  const { data } = (await admin
    .from("profiles")
    .select("email")
    .eq("empresa_id", empresaId)
    .in("role", ["owner", "admin", "ultra_admin"])) as { data: { email: string | null }[] | null };
  return (data ?? []).map((p) => p.email).filter((e): e is string => !!e);
}

serve(
  withSentryCron("trial-expiry-cron", "trial-expiry-daily", async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token || !CRON_SECRET || token !== CRON_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let processed = 0;
    let expired = 0;
    let converted = 0;
    let warned = 0;

    // ------------------------------------------------------------------
    // 1. Trials vencidos: quem tem cartão tokenizado (Ativar plano, SPEC 098
    //    Fase 2B) converte para active com a primeira cobrança; os demais
    //    seguem pro modo leitura (marcados expired, igual já fazia).
    // ------------------------------------------------------------------
    const { data: dueRows, error: dueQueryErr } = await admin
      .from("pilar_subscriptions")
      .select("id, empresa_id, plan_id, billing_cycle, asaas_customer_id, asaas_credit_card_token")
      .eq("status", "trialing")
      .lt("trial_ends_at", new Date().toISOString());

    if (dueQueryErr) {
      log.error("falha ao buscar trials vencidos", dueQueryErr);
    } else if (dueRows && dueRows.length > 0) {
      const toConvert = dueRows.filter((r) => r.asaas_credit_card_token && r.asaas_customer_id && r.plan_id);
      const toExpire = dueRows.filter((r) => !(r.asaas_credit_card_token && r.asaas_customer_id && r.plan_id));

      // --- Conversão automática (cobra com o token salvo, sem pedir o cartão de novo) ---
      for (const row of toConvert) {
        try {
          await converterEmAssinaturaAtiva(
            admin,
            {
              id: row.id,
              empresa_id: row.empresa_id,
              plan_id: row.plan_id!,
              billing_cycle: row.billing_cycle,
              asaas_customer_id: row.asaas_customer_id!,
              asaas_credit_card_token: row.asaas_credit_card_token!,
            },
            { appUrl: APP_URL, origem: "trial_expirado" }
          );
          converted++;
        } catch (err) {
          // Cobrança falhou (cartão recusado, Asaas fora do ar etc.) — cai no
          // mesmo caminho de quem nunca tokenizou: expira e vai pro modo
          // leitura. Não trava a empresa em trialing indefinidamente.
          log.error("falha ao converter trial em assinatura ativa, expirando", err, {
            empresa_id: row.empresa_id,
            subscription_id: row.id,
          });
          toExpire.push(row);
        }
      }

      // --- Expira quem não converteu (sem token, ou conversão falhou) ---
      if (toExpire.length > 0) {
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

          // SPEC 098 Fase 3 (ADR 0042): empresa entra em somente leitura no
          // exato momento em que expira sem forma de pagamento tokenizada.
          // leitura_desde é a fonte de verdade que a retencao-pos-trial usa
          // pra contar os 90 dias até a exclusão (ADR 0043).
          const empresaIds = toExpire.map((r) => r.empresa_id);
          const { error: leituraErr } = await admin
            .from("empresas")
            .update({ leitura_desde: new Date().toISOString() })
            .in("id", empresaIds)
            .is("leitura_desde", null);
          if (leituraErr) {
            log.error("falha ao marcar leitura_desde", leituraErr, { count: empresaIds.length });
          }

          const { data: empresasExpiradas } = (await admin
            .from("empresas")
            .select("id, nome")
            .in("id", empresaIds)) as { data: { id: string; nome: string }[] | null };
          const nomePorEmpresa = new Map((empresasExpiradas ?? []).map((e) => [e.id, e.nome]));

          for (const row of toExpire) {
            // SPEC 104: e-mail "seu teste acabou", com link pra assinar.
            // Falha de e-mail não desfaz a expiração.
            try {
              const recipients = await emailsDosAdmins(admin, row.empresa_id);
              if (recipients.length > 0) {
                await sendEmail({
                  classe: "plataforma",
                  tipo: "trial_expirado",
                  to: recipients,
                  idempotencyKey: `trial-expirado-${row.id}`,
                  ...templateTrialExpirado({
                    empresaNome: nomePorEmpresa.get(row.empresa_id) ?? "sua empresa",
                    billingUrl: `${APP_URL}/billing`,
                  }),
                });
              }
            } catch (mailErr) {
              log.warn("falha ao enviar e-mail de trial expirado", {
                empresa_id: row.empresa_id,
                err: String(mailErr),
              });
            }

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
              log.warn("falha ao inserir audit log de expiração", {
                empresa_id: row.empresa_id,
                err: String(auditErr),
              });
            }
          }
        }
      }

      processed += dueRows.length;
    }

    // ------------------------------------------------------------------
    // 2. Avisos de fim de trial (janelas em avisos.ts: 7d e 1d)
    // ------------------------------------------------------------------
    for (const window of JANELAS_DE_AVISO) {
      const { depoisDe, ateInclusive } = limitesDaJanela(window.days, new Date());

      const { data: toWarn, error: warnQueryErr } = (await admin
        .from("pilar_subscriptions")
        .select("id, empresa_id, trial_ends_at")
        .eq("status", "trialing")
        .gt("trial_ends_at", depoisDe)
        .lte("trial_ends_at", ateInclusive)
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

          const recipients = await emailsDosAdmins(admin, sub.empresa_id);

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

    log.info("cron finalizado", { processed, expired, converted, warned });

    return new Response(JSON.stringify({ processed, expired, converted, warned }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  })
);
