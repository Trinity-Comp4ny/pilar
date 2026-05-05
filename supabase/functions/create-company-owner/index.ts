import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { withSentry } from "../_shared/sentry.ts";

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

      const body = await req.json();
      const email = (body.email as string | undefined)?.trim().toLowerCase();
      const company_name = body.company_name as string | undefined;
      const nome = body.nome as string | undefined;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        log.warn("rejected: invalid email", {});
        throw new Error("email inválido");
      }
      if (!company_name || company_name.trim().length < 2) {
        log.warn("rejected: invalid company_name", {});
        throw new Error("company_name obrigatório (mínimo 2 chars)");
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Invalida convites anteriores não usados para o mesmo email
      await supabaseAdmin
        .from("empresa_owners_pending")
        .update({ usado_em: new Date().toISOString() })
        .eq("email", email)
        .is("usado_em", null);

      // Cria novo token pendente
      const { data: pending, error: insertError } = await supabaseAdmin
        .from("empresa_owners_pending")
        .insert({ email, company_name: company_name.trim(), nome: nome ?? null })
        .select("token")
        .single();

      if (insertError || !pending?.token) {
        throw new Error(insertError?.message ?? "Falha ao criar convite");
      }

      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${rawOrigin}/profile-setup`,
        data: {
          invite_token: pending.token,
          nome: nome ?? "",
        },
      });

      if (inviteError) throw inviteError;

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
