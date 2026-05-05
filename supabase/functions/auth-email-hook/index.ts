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
} from "../_shared/email.ts";

const log = createLogger("auth-email-hook");

const HOOK_SECRET = Deno.env.get("AUTH_HOOK_SEND_EMAIL_SECRET") ?? "";
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

type EmailActionType =
  | "signup"
  | "recovery"
  | "magiclink"
  | "invite"
  | "email_change"
  | "email_change_new"
  | "email_change_current"
  | "magic_link";

interface HookPayload {
  user: {
    id: string;
    email?: string;
    new_email?: string;
    user_metadata?: Record<string, string>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function decodeSecret(secret: string): Uint8Array {
  const b64 = secret.replace(/^v1,whsec_/, "").replace(/^whsec_/, "");
  const chars = atob(b64);
  const arr = new Uint8Array(chars.length);
  for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
  return arr;
}

async function verifyWebhook(req: Request, body: string): Promise<boolean> {
  if (!HOOK_SECRET) {
    log.error("AUTH_HOOK_SEND_EMAIL_SECRET not configured — refusing webhook");
    return false;
  }

  const id = req.headers.get("webhook-id");
  const timestamp = req.headers.get("webhook-timestamp");
  const signatureHeader = req.headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) {
    log.error("missing webhook headers", undefined, { id, timestamp, hasSignature: !!signatureHeader });
    return false;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const tsNum = parseInt(timestamp, 10);
  if (!Number.isFinite(tsNum) || Math.abs(nowSec - tsNum) > SIGNATURE_TOLERANCE_SECONDS) {
    log.error("timestamp out of tolerance", undefined, { tsNum, nowSec });
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    decodeSecret(HOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return signatureHeader.split(" ").some((s) => s === `v1,${expected}`);
}

function buildVerifyUrl(data: HookPayload["email_data"]): string {
  const { site_url, token_hash, email_action_type, redirect_to } = data;

  // Ensure recovery always lands on /reset-password regardless of what the client sent.
  let finalRedirect = redirect_to;
  if (email_action_type === "recovery" && redirect_to) {
    try {
      finalRedirect = `${new URL(redirect_to).origin}/reset-password`;
    } catch {
      // redirect_to is not a full URL; keep as-is
    }
  }

  const url = new URL("/auth/v1/verify", site_url);
  url.searchParams.set("token", token_hash);
  url.searchParams.set("type", email_action_type);
  if (finalRedirect) url.searchParams.set("redirect_to", finalRedirect);
  return url.toString();
}

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
          await sendEmail({
            to,
            subject: "Redefinir senha — Pilar",
            html: templateRecuperacaoSenha(link),
          });
          break;

        case "invite":
          await sendEmail({
            to,
            subject: "Você foi convidado para o Pilar",
            html: templateConviteUsuario(link, userName),
          });
          break;

        case "magic_link":
        case "magiclink":
          await sendEmail({
            to,
            subject: "Seu link de acesso — Pilar",
            html: templateMagicLink(link),
          });
          break;

        case "signup":
        case "email_change":
        case "email_change_new":
        case "email_change_current":
          await sendEmail({
            to,
            subject: "Confirme seu email — Pilar",
            html: templateConfirmacaoCadastro(link),
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
