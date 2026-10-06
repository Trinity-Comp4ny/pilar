import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
import { checkUserLimit, deliverInvite } from "./delivery.ts";

const log = createLogger("invite-user");

async function sha256(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

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
        const delivery = await deliverInvite(svc, conv.email, newToken, conv.nome ?? "", redirectOrigin);
        if (!delivery.ok) {
          log.error("resend delivery failed", delivery.error, { actor: user.id });
          return safeErrorResponse(delivery.status, delivery.message, req);
        }
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
        return jsonResponse({ success: true, conta_existente: delivery.conta_existente }, 200, req);
      }

      const { email, nome, role } = body ?? {};

      if (!email || !EMAIL_RE.test(String(email))) {
        return safeErrorResponse(400, "Invalid email format", req);
      }

      // ADR 0029: o convite carrega só o cargo. Acesso é role + módulo da
      // empresa; não existe mais nível por feature no usuário.
      const safeRole: AssignableRole = ASSIGNABLE_ROLES.includes(role) ? role : "user";

      // Limite de usuários (SPEC 098): limites_empresa() cobre pagante (plano +
      // override) e trial por nível — antes só pagante era checado aqui, trial
      // convidava sem teto nenhum.
      const { data: limites, error: limitesError } = await supabaseClient
        .rpc("limites_empresa", { p_empresa_id: profile.empresa_id })
        .maybeSingle();

      if (limitesError) {
        log.error("limites_empresa failed", limitesError, { empresa_id: profile.empresa_id });
        return safeErrorResponse(500, "Erro ao verificar limite de usuários", req);
      }

      const maxUsuarios = (limites as { max_usuarios?: number | null } | null)?.max_usuarios ?? null;

      if (maxUsuarios !== null) {
        const { reached, error: countErr } = await checkUserLimit(supabaseClient, profile.empresa_id, maxUsuarios);

        if (countErr) {
          log.error("failed to count active users", countErr, { empresa_id: profile.empresa_id });
          return safeErrorResponse(500, "Erro ao verificar limite de usuários", req);
        }

        if (reached) {
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

      const delivery = await deliverInvite(svc, email, token, nome || "", redirectOrigin);
      if (!delivery.ok) {
        log.error("invite delivery failed", delivery.error, { actor: user.id });
        // Falhas no acesso de contas órfãs permanecem reenviáveis. O cleanup
        // existente continua valendo para contas com profile e outros erros.
        if (!delivery.preservePending) {
          const { error: cleanupError } = await svc
            .from("convites")
            .update({ usado_em: new Date().toISOString() })
            .eq("empresa_id", profile.empresa_id)
            .eq("token_hash", await sha256(token))
            .is("usado_em", null);
          if (cleanupError) log.error("invite cleanup failed", cleanupError, { actor: user.id });
        }
        return safeErrorResponse(delivery.status, delivery.message, req);
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

      return jsonResponse({ success: true, email, conta_existente: delivery.conta_existente }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error);
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
