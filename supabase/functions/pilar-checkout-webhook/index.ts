/**
 * pilar-checkout-webhook — recebe eventos Asaas sobre cobranças/subscriptions do SaaS.
 *
 * Deploy: supabase functions deploy pilar-checkout-webhook --no-verify-jwt
 *
 * Responsabilidades:
 *  - validar header asaas-access-token (ASAAS_PLATFORM_WEBHOOK_TOKEN)
 *  - PAYMENT_CONFIRMED / PAYMENT_RECEIVED:
 *      * se pending_signup ainda pendente → marca pago, cria empresa_owners_pending,
 *        dispara inviteUserByEmail
 *      * se já linked a uma subscription ativa → atualiza current_period_end
 *      * se for compra de pacote de tokens (SPEC 077) → credita ai_token_ledger
 *  - PAYMENT_OVERDUE → subscription.status = 'overdue'
 *  - PAYMENT_REFUNDED → pending cancelada / subscription cancelada / compra cancelada
 *  - SUBSCRIPTION_ENDED → subscription.status = 'canceled'
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";
import { withSentry } from "../_shared/sentry.ts";
import { safeEqual } from "../_shared/crypto.ts";

const log = createLogger("pilar-checkout-webhook");

// Token de convite: 32 bytes aleatórios em hex. Só o hash é persistido
// (mesmo padrão de create-company-owner e create_convite).
function generateInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

interface WebhookPayload {
  event: string;
  payment?: {
    id: string;
    status: string;
    value: number;
    dueDate: string;
    paymentDate?: string;
    billingType: string;
    subscription?: string;
    externalReference?: string;
  };
  subscription?: {
    id: string;
    status: string;
  };
}

const ALLOWED_ORIGINS_APP = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

function appOrigin(): string {
  return ALLOWED_ORIGINS_APP[0] ?? "https://app.pilarsoft.com.br";
}

serve(
  withSentry("pilar-checkout-webhook", async (req) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const receivedToken = req.headers.get("asaas-access-token");
    const expectedToken = Deno.env.get("ASAAS_PLATFORM_WEBHOOK_TOKEN");

    if (!expectedToken) {
      log.error("ASAAS_PLATFORM_WEBHOOK_TOKEN não configurado");
      return new Response("Misconfigured", { status: 500 });
    }
    if (!receivedToken || !safeEqual(receivedToken, expectedToken)) {
      return new Response("Unauthorized", { status: 401 });
    }

    let payload: WebhookPayload;
    try {
      payload = (await req.json()) as WebhookPayload;
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { event, payment, subscription } = payload;
    const paymentId = payment?.id ?? null;
    const subId = payment?.subscription ?? subscription?.id ?? null;

    // Log sempre (auditoria).
    // Idempotência: índices únicos em (event, asaas_payment_id) e (event, asaas_subscription_id)
    // fazem INSERT falhar em duplicata → tratamos como noop sem reprocessar.
    const { data: logRow, error: logErr } = await admin
      .from("pilar_checkout_webhook_logs")
      .insert({
        event,
        asaas_payment_id: paymentId,
        asaas_subscription_id: subId,
        payload,
      })
      .select("id")
      .single();

    if (logErr?.code === "23505") {
      return new Response("OK (duplicate, ignored)", { status: 200 });
    }

    const logId = logRow?.id ?? null;

    try {
      // Busca pending_signup (prioridade: externalReference > payment_id > subscription_id)
      let signup: {
        id: string;
        email: string;
        nome: string;
        company_name: string;
        payment_status: string;
        invite_dispatched_at: string | null;
        empresa_owner_pending_id: string | null;
      } | null = null;

      const extRef = payment?.externalReference;
      if (extRef) {
        const { data } = await admin
          .from("pilar_pending_signups")
          .select("id, email, nome, company_name, payment_status, invite_dispatched_at, empresa_owner_pending_id")
          .eq("id", extRef)
          .maybeSingle();
        signup = data ?? null;
      }

      if (!signup && paymentId) {
        const { data } = await admin
          .from("pilar_pending_signups")
          .select("id, email, nome, company_name, payment_status, invite_dispatched_at, empresa_owner_pending_id")
          .eq("asaas_payment_id", paymentId)
          .maybeSingle();
        signup = data ?? null;
      }

      if (!signup && subId) {
        const { data } = await admin
          .from("pilar_pending_signups")
          .select("id, email, nome, company_name, payment_status, invite_dispatched_at, empresa_owner_pending_id")
          .eq("asaas_subscription_id", subId)
          .maybeSingle();
        signup = data ?? null;
      }

      // Subscription ativa — atualizar período/status
      let activeSub: { id: string; empresa_id: string; billing_cycle: string | null } | null = null;
      if (subId) {
        const { data } = await admin
          .from("pilar_subscriptions")
          .select("id, empresa_id, billing_cycle")
          .eq("asaas_subscription_id", subId)
          .maybeSingle();
        activeSub = data ?? null;
      }

      // Compra de pacote de tokens (SPEC 077) — mutuamente exclusiva com signup:
      // externalReference é ou um pilar_pending_signups.id ou um
      // pilar_token_pack_purchases.id, nunca os dois.
      let tokenPack: {
        id: string;
        empresa_id: string;
        user_id: string | null;
        quantidade_pacotes: number;
        tokens_pacote: number;
        status: string;
      } | null = null;

      if (!signup && extRef) {
        const { data } = await admin
          .from("pilar_token_pack_purchases")
          .select("id, empresa_id, user_id, quantidade_pacotes, tokens_pacote, status")
          .eq("id", extRef)
          .maybeSingle();
        tokenPack = data ?? null;
      }
      if (!signup && !tokenPack && paymentId) {
        const { data } = await admin
          .from("pilar_token_pack_purchases")
          .select("id, empresa_id, user_id, quantidade_pacotes, tokens_pacote, status")
          .eq("asaas_payment_id", paymentId)
          .maybeSingle();
        tokenPack = data ?? null;
      }

      // --- Eventos de pagamento recebido ---
      if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
        const paidAt = payment?.paymentDate ? new Date(payment.paymentDate).toISOString() : new Date().toISOString();

        // 1. Signup pendente → primeira liberação
        if (signup && signup.payment_status !== "paid") {
          await admin
            .from("pilar_pending_signups")
            .update({
              payment_status: "paid",
              paid_at: paidAt,
              ...(paymentId && { asaas_payment_id: paymentId }),
            })
            .eq("id", signup.id);
        }

        // 2. Disparar invite se ainda não foi
        if (signup && !signup.invite_dispatched_at) {
          // Cria empresa_owners_pending (reusa fluxo de convite existente).
          // Upsert atômico por email: cobre tanto a corrida de dois webhooks
          // concorrentes pro mesmo email quanto o re-convite de um email que já
          // teve um pending anterior (usado ou expirado) — email é UNIQUE na
          // tabela, então um INSERT simples falharia nesse segundo caso.
          // Token: só o hash é persistido (o plaintext trafega apenas no invite).
          const rawToken = generateInviteToken();
          const tokenHash = await sha256Hex(rawToken);

          const { data: ownerPending, error: ownerErr } = await admin
            .from("empresa_owners_pending")
            .upsert(
              {
                email: signup.email,
                company_name: signup.company_name,
                nome: signup.nome,
                token_hash: tokenHash,
                usado_em: null,
                expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              },
              { onConflict: "email" }
            )
            .select("id")
            .single();

          if (ownerErr || !ownerPending) {
            throw new Error(`falha ao criar empresa_owners_pending: ${ownerErr?.message}`);
          }

          // Grava empresa_owner_pending_id ANTES de disparar o invite: o
          // inviteUserByEmail cria a linha em auth.users de forma síncrona, e o
          // trigger handle_new_user (CENÁRIO 2) lê pilar_pending_signups por esse
          // campo para confirmar o pagamento. Gravar depois é tarde demais — o
          // trigger sempre acha o campo vazio e recusa o cadastro com "sem
          // pagamento confirmado", mesmo com payment_status já 'paid' (achado
          // testando o fluxo ponta a ponta em sandbox, 2026-09-01).
          await admin
            .from("pilar_pending_signups")
            .update({ empresa_owner_pending_id: ownerPending.id })
            .eq("id", signup.id);

          // Dispara email com magic link — falha não bloqueia o 200 (cron vai retentar)
          try {
            const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(signup.email, {
              redirectTo: `${appOrigin()}/profile-setup`,
              data: {
                invite_token: rawToken,
                nome: signup.nome,
                is_pilar_subscriber: true,
              },
            });

            if (inviteErr) {
              throw new Error(`inviteUserByEmail: ${inviteErr.message}`);
            }

            await admin
              .from("pilar_pending_signups")
              .update({ invite_dispatched_at: new Date().toISOString() })
              .eq("id", signup.id);
          } catch (inviteEx) {
            const errMsg = inviteEx instanceof Error ? inviteEx.message : "invite dispatch failed";
            log.error("invite dispatch failed — will retry via cron", inviteEx, {
              email: signup.email,
              signup_id: signup.id,
            });
            // Registra falha no audit log para visibilidade operacional. actor_id
            // é nullable (migration 20260884000000): ação do sistema, sem ator humano.
            await admin.from("admin_audit_logs").insert({
              actor_id: null,
              actor_email: "system@pilar",
              actor_role: "ultra_admin",
              action: "invite_dispatch_failed",
              category: "billing",
              target_type: "pending_signup",
              target_id: signup.id,
              target_name: signup.email,
              empresa_id: null,
              metadata: { error: errMsg, owner_pending_id: ownerPending.id },
            });
          }
        }

        // 3. trial_ends_at para novos signups
        // Para signups novos, a subscription é criada pelo trigger
        // tg_pilar_link_subscription_on_owner_used (migration 027) durante o profile-setup,
        // não no momento do pagamento. Por isso, buscamos a subscription pelo pending_signup_id
        // e definimos trial_ends_at se ainda não estiver preenchido.
        if (signup) {
          const { data: newSub } = await admin
            .from("pilar_subscriptions")
            .select("id, trial_ends_at")
            .eq("pending_signup_id", signup.id)
            .maybeSingle();

          if (newSub && !newSub.trial_ends_at) {
            const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
            await admin
              .from("pilar_subscriptions")
              .update({ trial_ends_at: trialEnd })
              .eq("id", newSub.id);
          }
        }

        // 4. Compra de pacote de tokens → crédito no ledger
        if (tokenPack) {
          if (tokenPack.status !== "paid") {
            await admin
              .from("pilar_token_pack_purchases")
              .update({
                status: "paid",
                paid_at: paidAt,
                ...(paymentId && { asaas_payment_id: paymentId }),
              })
              .eq("id", tokenPack.id);
          }

          // Idempotência real: NÃO depende do status acima (uma cobrança já
          // confirmada na criação, ex. cartão instantâneo, chegaria aqui com
          // status já 'paid'). O UNIQUE em reference_id garante que o replay
          // do webhook nunca credita duas vezes, mesmo reprocessando sempre.
          const { error: creditErr } = await admin.from("ai_token_ledger").insert({
            empresa_id: tokenPack.empresa_id,
            user_id: tokenPack.user_id,
            agent_key: "compra",
            source: "purchase",
            tokens_delta: tokenPack.quantidade_pacotes * tokenPack.tokens_pacote,
            reference_id: `token_pack_purchase:${tokenPack.id}`,
          });

          if (creditErr && creditErr.code !== "23505") {
            throw new Error(`falha ao creditar ledger da compra ${tokenPack.id}: ${creditErr.message}`);
          }
        }

        // 5. Renovação de subscription ativa → estender período
        if (activeSub && !signup) {
          const periodEnd =
            activeSub.billing_cycle === "yearly"
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          await admin
            .from("pilar_subscriptions")
            .update({
              status: "active",
              current_period_start: paidAt,
              current_period_end: periodEnd,
            })
            .eq("id", activeSub.id);
        }
      }

      // --- Inadimplência ---
      if (event === "PAYMENT_OVERDUE") {
        if (activeSub) {
          await admin.from("pilar_subscriptions").update({ status: "overdue" }).eq("id", activeSub.id);
        }
        if (signup && signup.payment_status === "pending") {
          await admin.from("pilar_pending_signups").update({ payment_status: "failed" }).eq("id", signup.id);
        }
        if (tokenPack && tokenPack.status === "pending") {
          await admin.from("pilar_token_pack_purchases").update({ status: "failed" }).eq("id", tokenPack.id);
        }
      }

      // --- Reembolso / deletado ---
      if (event === "PAYMENT_REFUNDED" || event === "PAYMENT_DELETED") {
        if (signup) {
          await admin.from("pilar_pending_signups").update({ payment_status: "canceled" }).eq("id", signup.id);
        }
        if (activeSub) {
          await admin
            .from("pilar_subscriptions")
            .update({ status: "canceled", canceled_at: new Date().toISOString() })
            .eq("id", activeSub.id);
        }
        // Estorno de compra já creditada não é revertido automaticamente no ledger
        // (mesmo risco aceito do fluxo de signup — SPEC 077, seção Decisões e riscos).
        if (tokenPack && tokenPack.status !== "paid") {
          await admin.from("pilar_token_pack_purchases").update({ status: "canceled" }).eq("id", tokenPack.id);
        }
      }

      // --- Subscription encerrada ---
      if (event === "SUBSCRIPTION_ENDED" || event === "SUBSCRIPTION_DELETED") {
        if (activeSub) {
          await admin
            .from("pilar_subscriptions")
            .update({ status: "canceled", canceled_at: new Date().toISOString() })
            .eq("id", activeSub.id);
        }
      }

      if (logId) {
        await admin
          .from("pilar_checkout_webhook_logs")
          .update({
            processed: true,
            pending_signup_id: signup?.id ?? null,
            subscription_id: activeSub?.id ?? null,
          })
          .eq("id", logId);
      }

      return new Response("OK", { status: 200 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro";
      log.error("webhook processing failed", err, {
        event,
        payment_id: paymentId,
        subscription_id: subId,
        log_id: logId,
      });
      if (logId) {
        await admin.from("pilar_checkout_webhook_logs").update({ processed: false, error: msg }).eq("id", logId);
      }
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  })
);
