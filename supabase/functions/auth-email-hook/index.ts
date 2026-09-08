/**
 * Supabase Auth "Send Email" hook.
 *
 * Supabase POSTs here via standard-webhooks format whenever it would send an
 * auth email (signup confirm, recovery, magic link, email change, admin invite).
 * We verify the HMAC signature, route to the right Resend template, return 200.
 *
 * Secret: configured in supabase/config.toml as
 *   `secrets = "env(AUTH_HOOK_SEND_EMAIL_SECRET)"`
 * and issued by Supabase when you register the hook in the dashboard
 * (format: "v1,whsec_<base64>").
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";

import {
  sendEmail,
  templateConfirmacaoCadastro,
  templateConviteUsuario,
  templateMagicLink,
  templateRecuperacaoSenha,
} from "../_shared/email/index.ts";
import { buildVerifyUrl, verifyWebhook, type HookPayload } from "./webhook.ts";

const log = createLogger("auth-email-hook");

serve(
  withSentry("auth-email-hook", async (req) => {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await req.text();

    if (!(await verifyWebhook(req, body))) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload: HookPayload;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { user, email_data } = payload;
    const to = user.email?.trim();
    if (!to) {
      return new Response(JSON.stringify({ error: "User email missing" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const link = buildVerifyUrl(email_data);
    const userName = user.user_metadata?.nome ?? user.user_metadata?.full_name;

    try {
      switch (email_data.email_action_type) {
        case "recovery":
          await sendEmail({ classe: "plataforma", tipo: "auth_recovery", to, ...templateRecuperacaoSenha(link) });
          break;

        case "invite":
          await sendEmail({ classe: "plataforma", tipo: "auth_invite", to, ...templateConviteUsuario(link, userName) });
          break;

        case "magic_link":
        case "magiclink":
          await sendEmail({ classe: "plataforma", tipo: "auth_magic_link", to, ...templateMagicLink(link) });
          break;

        case "signup":
        case "email_change":
        case "email_change_new":
        case "email_change_current":
          await sendEmail({
            classe: "plataforma",
            tipo: `auth_${email_data.email_action_type}`,
            to,
            ...templateConfirmacaoCadastro(link),
          });
          break;

        default:
          log.warn("tipo de email desconhecido", { email_action_type: email_data.email_action_type });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      log.error("send email failed", err, { email_action_type: email_data.email_action_type, user_id: user.id });
      return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Failed to send" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  })
);
