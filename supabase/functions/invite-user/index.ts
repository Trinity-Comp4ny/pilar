import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  authenticateUser,
  getTrustedOrigin,
  jsonResponse,
  optionsResponse,
  safeErrorResponse,
} from "../_shared/cors.ts";
import { EMAIL_RE } from "../_shared/validators.ts";
import { adminClient } from "../_shared/admin-auth.ts";
import { logAction } from "../_shared/audit.ts";
import { createLogger } from "../_shared/logger.ts";
import { withSentry } from "../_shared/sentry.ts";

const log = createLogger("invite-user");

// admin/coordenador/user via UI (ADR 0034). ultra_admin é exclusivo via SQL direto.
// Roles legados (owner/colaborador/financeiro/marketing/operacional) caem no fallback 'user'.
const ASSIGNABLE_ROLES = ["admin", "coordenador", "user"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

serve(
  withSentry("invite-user", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST" && req.method !== "DELETE") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase: supabaseClient, user } = auth;

    try {
      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("empresa_id, role, email")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) return safeErrorResponse(403, "Profile not found", req);
      if (profile.role !== "admin" && profile.role !== "ultra_admin") {
        return safeErrorResponse(403, "Only admins can invite users", req);
      }
      if (!profile.empresa_id) return safeErrorResponse(403, "You must belong to a company to invite users", req);

      const body = await req.json().catch(() => ({}));
      const redirectOrigin = getTrustedOrigin(req);
      if (!redirectOrigin) return safeErrorResponse(500, "Server CORS misconfigured", req);
      const svc = adminClient();

      // ── Cancelar convite pendente (escopo: própria empresa) ──────────────
      if (req.method === "DELETE") {
        const { convite_id } = body ?? {};
        if (!convite_id) return safeErrorResponse(400, "convite_id obrigatório", req);
        const { data: conv } = await supabaseClient
          .from("convites")
          .select("id, email, empresa_id")
          .eq("id", convite_id)
          .maybeSingle();
        if (!conv || conv.empresa_id !== profile.empresa_id) {
          return safeErrorResponse(404, "Convite não encontrado", req);
        }
        const { error: delErr } = await svc.from("convites").delete().eq("id", convite_id);
        if (delErr) return safeErrorResponse(400, delErr.message, req);
        await logAction(svc, {
          actorId: user.id,
          actorEmail: profile.email ?? user.email ?? "",
          actorRole: profile.role as "ultra_admin" | "admin",
          action: "cancel_invite",
          category: "member",
          targetType: "convite",
          targetId: convite_id,
          targetName: conv.email,
          empresaId: profile.empresa_id,
          req,
        });
        return jsonResponse({ success: true }, 200, req);
      }

      // ── Reenviar convite pendente (escopo: própria empresa) ──────────────
      if (body?.action === "resend") {
        const { convite_id } = body ?? {};
        if (!convite_id) return safeErrorResponse(400, "convite_id obrigatório", req);
        const { data: conv } = await supabaseClient
          .from("convites")
          .select("id, email, nome, empresa_id, usado_em")
          .eq("id", convite_id)
          .maybeSingle();
        if (!conv || conv.empresa_id !== profile.empresa_id || conv.usado_em) {
          return safeErrorResponse(404, "Convite não encontrado ou já usado", req);
        }
        // Gera um novo token (o plaintext antigo não é mais armazenado) e renova a validade.
        const { data: newToken, error: regenErr } = await svc.rpc("regenerate_convite_token", {
          p_convite_id: convite_id,
        });
        if (regenErr || !newToken) return safeErrorResponse(400, "Falha ao reenviar o convite", req);
        const { error: resendErr } = await svc.auth.admin.inviteUserByEmail(conv.email, {
          redirectTo: `${redirectOrigin}/profile-setup`,
          data: { invite_token: newToken, nome: conv.nome ?? "" },
        });
        if (resendErr) return safeErrorResponse(400, "Falha ao reenviar o convite", req);
        await logAction(svc, {
          actorId: user.id,
          actorEmail: profile.email ?? user.email ?? "",
          actorRole: profile.role as "ultra_admin" | "admin",
          action: "resend_invite",
          category: "member",
          targetType: "convite",
          targetId: convite_id,
          targetName: conv.email,
          empresaId: profile.empresa_id,
          req,
        });
        return jsonResponse({ success: true }, 200, req);
      }

      const { email, nome, role } = body ?? {};

      if (!email || !EMAIL_RE.test(String(email))) {
        return safeErrorResponse(400, "Invalid email format", req);
      }

      // ADR 0029: o convite carrega só o cargo. Acesso é role + módulo da
      // empresa; não existe mais nível por feature no usuário.
      const safeRole: AssignableRole = ASSIGNABLE_ROLES.includes(role) ? role : "user";

      // Verificar limite de usuários do plano da empresa
      const { data: planLimit } = await supabaseClient
        .from("pilar_subscriptions")
        .select("pilar_subscription_plans(max_usuarios)")
        .eq("empresa_id", profile.empresa_id)
        .eq("status", "active")
        .maybeSingle();

      const maxUsuarios =
        (planLimit as { pilar_subscription_plans?: { max_usuarios?: number | null } } | null)?.pilar_subscription_plans
          ?.max_usuarios ?? null;

      if (maxUsuarios !== null) {
        const { count: activeCount, error: countErr } = await supabaseClient
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", profile.empresa_id)
          .is("deleted_at", null);

        if (countErr) {
          log.error("failed to count active users", countErr, { empresa_id: profile.empresa_id });
          return safeErrorResponse(500, "Erro ao verificar limite de usuários", req);
        }

        if ((activeCount ?? 0) >= maxUsuarios) {
          return safeErrorResponse(
            422,
            `Limite de usuários atingido para o plano atual (${maxUsuarios} usuário${maxUsuarios === 1 ? "" : "s"})`,
            req
          );
        }
      }

      // Rate limit anti-spam: 5/min, 50/hour por empresa
      const { error: rateLimitError } = await supabaseClient.rpc("check_convite_rate_limit", {
        p_empresa_id: profile.empresa_id,
      });
      if (rateLimitError) {
        return safeErrorResponse(429, rateLimitError.message ?? "Rate limit excedido", req);
      }

      const { data: token, error: conviteError } = await supabaseClient.rpc("create_convite", {
        p_email: email,
        p_cargo: safeRole,
        p_nome: nome || null,
      });

      if (conviteError || !token) {
        log.error("create_convite failed", conviteError, { actor: user.id });
        return safeErrorResponse(400, conviteError?.message ?? "Falha ao criar convite", req);
      }

      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${redirectOrigin}/profile-setup`,
        data: {
          invite_token: token,
          nome: nome || "",
        },
      });

      if (inviteError) {
        log.error("inviteUserByEmail failed", inviteError, { actor: user.id });
        // create_convite já grava a linha "pendente" antes do e-mail sair. Sem isto, uma
        // falha de envio deixava a linha órfã pra sempre: nenhum e-mail chegou, mas a UI
        // seguia mostrando convite pendente e ninguém sabia que precisava reenviar.
        await svc
          .from("convites")
          .update({ usado_em: new Date().toISOString() })
          .eq("empresa_id", profile.empresa_id)
          .eq("email", String(email).toLowerCase().trim())
          .is("usado_em", null);
        return safeErrorResponse(400, "Falha ao enviar convite", req);
      }

      await logAction(svc, {
        actorId: user.id,
        actorEmail: profile.email ?? user.email ?? "",
        actorRole: profile.role as "ultra_admin" | "admin",
        action: "invite_user",
        category: "member",
        targetType: "user",
        targetName: nome || email,
        empresaId: profile.empresa_id,
        metadata: { email, role: safeRole },
        req,
      });

      return jsonResponse({ success: true, email }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error);
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
