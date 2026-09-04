// Lógica pura do hook (verificação de assinatura + montagem da URL de
// verificação), separada de index.ts de propósito: index.ts chama serve(...)
// no top-level do módulo, então importá-lo de um teste ligaria um listener
// HTTP de verdade. Este arquivo não tem side effect nenhum, é seguro de importar.

import { createLogger } from "../_shared/logger.ts";

const log = createLogger("auth-email-hook");

const HOOK_SECRET = Deno.env.get("AUTH_HOOK_SEND_EMAIL_SECRET") ?? "";
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type EmailActionType =
  | "signup"
  | "recovery"
  | "magiclink"
  | "invite"
  | "email_change"
  | "email_change_new"
  | "email_change_current"
  | "magic_link";

export interface HookPayload {
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

// Uint8Array<ArrayBuffer> explícito: com o lib do Deno 2.x, o `Uint8Array` genérico
// (ArrayBufferLike) não é aceito como BufferSource em crypto.subtle.importKey.
function decodeSecret(secret: string): Uint8Array<ArrayBuffer> {
  const b64 = secret.replace(/^v1,whsec_/, "").replace(/^whsec_/, "");
  const chars = atob(b64);
  const arr = new Uint8Array(chars.length);
  for (let i = 0; i < chars.length; i++) arr[i] = chars.charCodeAt(i);
  return arr;
}

export async function verifyWebhook(req: Request, body: string): Promise<boolean> {
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

export function buildVerifyUrl(data: HookPayload["email_data"]): string {
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
