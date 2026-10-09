import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { withSentry } from "../_shared/sentry.ts";
import { checkDbRateLimit, getClientKey } from "../_shared/db-rate-limit.ts";
import { parseOr400 } from "../_shared/schemas.ts";
import { gerarConviteToken } from "../_shared/convite-token.ts";
import { createOwnerSchema, verificarRequisicao } from "./portao.ts";

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

    // Método, Content-Type, Origin e chave: regra e ordem em portao.ts (com teste).
    const veredito = verificarRequisicao(
      {
        method: req.method,
        contentType: req.headers.get("content-type"),
        origin: req.headers.get("origin"),
        superAdminKey: req.headers.get("x-super-admin-key"),
      },
      { allowedOrigins: Deno.env.get("ALLOWED_ORIGINS") ?? "", superAdminKey: Deno.env.get("SUPER_ADMIN_KEY") }
    );
    if (!veredito.ok) {
      if (veredito.status >= 500) log.error(veredito.motivo, null);
      else
        log.warn(`rejected: ${veredito.motivo}`, {
          origin: req.headers.get("origin"),
          contentType: req.headers.get("content-type"),
          hasKey: Boolean(req.headers.get("x-super-admin-key")),
        });
      return new Response(JSON.stringify({ error: veredito.error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: veredito.status,
      });
    }
    const rawOrigin = veredito.origin;

    try {
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
      const { token: rawToken, hash: tokenHash } = await gerarConviteToken();
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
