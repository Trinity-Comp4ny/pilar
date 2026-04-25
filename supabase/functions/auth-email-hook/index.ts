import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  sendEmail,
  templateConfirmacaoCadastro,
  templateConviteUsuario,
  templateMagicLink,
  templateRecuperacaoSenha,
} from "../_shared/email.ts";

const HOOK_SECRET = Deno.env.get("AUTH_HOOK_SEND_EMAIL_SECRET") ?? "";
const SKIP_VERIFICATION = Deno.env.get("HOOK_SKIP_VERIFICATION") === "true";

type EmailActionType = "signup" | "recovery" | "invite" | "magic_link" | "email_change_new" | "email_change_current";

interface HookPayload {
  user: { email: string; user_metadata?: Record<string, string> };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
  };
}

// Verifica assinatura HMAC-SHA256 que o Supabase inclui no header Authorization
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const [version, signatureB64] = authHeader.split(",");
  if (version !== "v1" || !signatureB64) return false;

  // HOOK_SECRET formato: "v1,whsec_<base64>"
  const secretB64 = HOOK_SECRET.replace("v1,whsec_", "");
  const secretBytes = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);

  const signatureBytes = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0));
  const bodyBytes = new TextEncoder().encode(rawBody);

  return crypto.subtle.verify("HMAC", key, signatureBytes, bodyBytes);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const rawBody = await req.text();

  if (!SKIP_VERIFICATION) {
    const valid = await verifySignature(req, rawBody);
    if (!valid) {
      console.error(
        "[auth-email-hook] assinatura inválida — Authorization:",
        req.headers.get("Authorization")?.slice(0, 30)
      );
      return new Response("Unauthorized", { status: 401 });
    }
  }

  try {
    const { user, email_data }: HookPayload = JSON.parse(rawBody);
    const { email_action_type, token_hash, redirect_to, site_url } = email_data;
    const userEmail = user.email;
    const userName = user.user_metadata?.nome ?? user.user_metadata?.full_name;

    // Garante que recovery sempre aponta para /reset-password.
    // Usa o origin do redirect_to (seja qual for o env) sem duplicar o path.
    const appOrigin = new URL(redirect_to).origin;
    const finalRedirect = email_action_type === "recovery" ? `${appOrigin}/reset-password` : redirect_to;

    const confirmLink = `${site_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(finalRedirect)}`;

    switch (email_action_type) {
      case "recovery":
        await sendEmail({
          to: userEmail,
          subject: "Redefinir senha — Pilar",
          html: templateRecuperacaoSenha(confirmLink),
        });
        break;

      case "invite":
        await sendEmail({
          to: userEmail,
          subject: "Você foi convidado para o Pilar",
          html: templateConviteUsuario(confirmLink, userName),
        });
        break;

      case "magic_link":
        await sendEmail({
          to: userEmail,
          subject: "Seu link de acesso — Pilar",
          html: templateMagicLink(confirmLink),
        });
        break;

      case "signup":
      case "email_change_new":
      case "email_change_current":
        await sendEmail({
          to: userEmail,
          subject: "Confirme seu email — Pilar",
          html: templateConfirmacaoCadastro(confirmLink),
        });
        break;

      default:
        console.warn("[auth-email-hook] tipo desconhecido:", email_action_type);
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[auth-email-hook]", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});
