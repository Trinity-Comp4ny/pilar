import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { withSentry } from "../_shared/sentry.ts";
import { checkDbRateLimit, getClientKey } from "../_shared/db-rate-limit.ts";
import { emailSchema, nameSchema, parseOr400, z } from "../_shared/schemas.ts";

const createOwnerSchema = z.object({
  email: emailSchema,
  company_name: nameSchema,
  nome: z.string().trim().min(1).max(200).optional(),
});

// Token de convite: 32 bytes aleatórios em hex. Só o hash é persistido.
function generateInviteToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Cria convite para novo tenant (dono de empresa).
// Requer header X-Super-Admin-Key matching SUPER_ADMIN_KEY (env).
// Endpoint bootstrap — não acessível a usuários comuns.
//
// Hardening anti-CSRF:
//  - Origin obrigatoriamente em ALLOWED_ORIGINS (rejeita ao invés de fallback).
//  - Método POST + Content-Type application/json (rejeita form-encoded de origens
//    hostis que poderiam fazer cross-site form post mesmo com a chave vazada).
//  - Logs estruturados em todas as tentativas inválidas para alertar abuso.

serve(
  withSentry("create-company-owner", async (req) => {
    const corsHeaders = getCorsHeaders(req);
    const log = createLogger("create-company-owner", {
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
      ua: req.headers.get("user-agent") ?? null,
    });

    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      log.warn("rejected: method not allowed", { method: req.method });
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405,
      });
    }

    // Content-Type estrito: rejeita form-encoded / multipart (vetor CSRF clássico).
    const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("application/json")) {
      log.warn("rejected: invalid content-type", { contentType });
      return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 415,
      });
    }

    // Origin obrigatória e em allowlist (defesa em profundidade pra CSRF).
    const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter(Boolean);

    if (ALLOWED_ORIGINS.length === 0) {
      log.error("ALLOWED_ORIGINS not configured", null);
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const rawOrigin = (req.headers.get("origin") || "").replace(/\/$/, "");
    if (!rawOrigin || !ALLOWED_ORIGINS.includes(rawOrigin)) {
      log.warn("rejected: origin not allowed", { origin: rawOrigin || null });
      return new Response(JSON.stringify({ error: "Origin not allowed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    try {
      const providedKey = req.headers.get("x-super-admin-key");
      const expectedKey = Deno.env.get("SUPER_ADMIN_KEY");

      if (!expectedKey) {
        log.error("SUPER_ADMIN_KEY not configured", null);
        throw new Error("SUPER_ADMIN_KEY não configurada no ambiente");
      }

      if (!providedKey || providedKey !== expectedKey) {
        log.warn("rejected: invalid super admin key", { hasKey: Boolean(providedKey) });
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }

      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        log.warn("rejected: invalid json", {});
        throw new Error("JSON inválido");
      }
      const parsed = parseOr400(createOwnerSchema, raw);
      if (!parsed.ok) {
        log.warn("rejected: validation failed", { reason: parsed.error });
        throw new Error(parsed.error);
      }
      const { email, company_name, nome } = parsed.data;

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Rate limit por IP (defesa em profundidade se SUPER_ADMIN_KEY vazar)
      const rl = await checkDbRateLimit(supabaseAdmin, {
        bucket: "create_company_owner",
        key: getClientKey(req),
        max: 10,
        windowSeconds: 3600,
      });
      if (rl.rpcError) {
        log.error("rate limit check failed — fail-closed", null, { rpcError: rl.rpcError });
        return new Response(JSON.stringify({ error: "Serviço indisponível" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 503,
        });
      }
      if (!rl.allowed) {
        log.warn("rate limited", { origin: rawOrigin });
        return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }

      // Cria novo token pendente. O token cru só trafega no invite; no banco
      // guardamos apenas o hash sha256 (ACH-AUTH-04), igual ao convite de equipe.
      // Upsert atômico por email (email é UNIQUE na tabela): substitui o padrão
      // anterior de "invalida convite antigo, depois insere novo", que falhava
      // com 23505 ao reconvidar um email que já teve QUALQUER pending anterior
      // (usado ou expirado) e também deixava uma janela de corrida entre os dois
      // requests em cliques duplicados.
      const rawToken = generateInviteToken();
      const tokenHash = await sha256Hex(rawToken);
      const { data: pending, error: upsertError } = await supabaseAdmin
        .from("empresa_owners_pending")
        .upsert(
          {
            email,
            company_name,
            nome: nome ?? null,
            token_hash: tokenHash,
            usado_em: null,
            expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
          { onConflict: "email" }
        )
        .select("id")
        .single();

      if (upsertError || !pending?.id) {
        throw new Error(upsertError?.message ?? "Falha ao criar convite");
      }

      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${rawOrigin}/profile-setup`,
        data: {
          invite_token: rawToken,
          nome: nome ?? "",
        },
      });

      if (inviteError) throw inviteError;

      // trial_ends_at: a subscription é criada pelo trigger tg_pilar_link_subscription_on_owner_used
      // (migration 027) quando o usuário completa o profile-setup e seta empresa_owners_pending.usado_em.
      // O pilar-checkout-webhook seta trial_ends_at=NOW()+14d na subscription após o pagamento confirmado.
      // Para empresas criadas manualmente aqui (admin flow), não há trial — trial_ends_at permanece NULL.

      log.info("company owner invite created", { origin: rawOrigin });

      return new Response(JSON.stringify({ success: true, email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Internal error";
      log.error("create-company-owner failed", error);
      return new Response(JSON.stringify({ error: message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
  })
);
