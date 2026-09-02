/**
 * Edge function: ultra-admin-usuarios
 *
 * PUT  → atualizar role de um usuário (cross-empresa)
 * POST → convidar usuário em nome de outra empresa
 *
 * Requer role = ultra_admin.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { isUUID, jsonResponse, optionsResponse, safeErrorResponse, getTrustedOrigin } from "../_shared/cors.ts";
import { requireUltraAdmin } from "../_shared/admin-auth.ts";
import { logAction } from "../_shared/audit.ts";
import { withSentry } from "../_shared/sentry.ts";
import { isEmailExistsError } from "../_shared/auth-errors.ts";

serve(
  withSentry("ultra-admin-usuarios", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);

    const auth = await requireUltraAdmin(req);
    if (auth.error) return auth.error;
    const { svc, userId, actorEmail } = auth;

    // ─── PUT: atualizar usuário existente ─────────────────────────────────
    if (req.method === "PUT") {
      const body = await req.json();
      const { user_id, role, empresa_id } = body ?? {};

      if (!isUUID(user_id)) return safeErrorResponse(400, "user_id inválido", req);

      const { data: target, error: targetErr } = await svc
        .from("profiles")
        .select("email, nome, role, empresa_id")
        .eq("id", user_id)
        .single();

      if (targetErr || !target) return safeErrorResponse(404, "Usuário não encontrado", req);

      // ADR 0029/0034: role decide hierarquia; financeiro é eixo à parte
      // (profiles.financeiro_delegado, não muda por aqui).
      const safeRole = ["admin", "coordenador", "user"].includes(role) ? role : target.role;

      const { error } = await svc.from("profiles").update({ role: safeRole }).eq("id", user_id);

      if (error) return safeErrorResponse(400, error.message, req);

      await logAction(svc, {
        actorId: userId,
        actorEmail,
        actorRole: "ultra_admin",
        action: "update_user_access",
        category: "member",
        targetType: "user",
        targetId: user_id,
        targetName: target.email ?? target.nome ?? user_id,
        empresaId: empresa_id ?? target.empresa_id ?? null,
        metadata: { old: { role: target.role }, new: { role: safeRole } },
        req,
      });

      return jsonResponse({ success: true }, 200, req);
    }

    // ─── DELETE: remover usuário OU cancelar convite pendente ─────────────
    if (req.method === "DELETE") {
      const body = await req.json();
      const { user_id, empresa_id, convite_id } = body ?? {};

      // Cancelar convite pendente (não é um usuário ainda)
      if (convite_id) {
        if (!isUUID(convite_id)) return safeErrorResponse(400, "convite_id inválido", req);
        const { data: conv } = await svc
          .from("convites")
          .select("email, empresa_id")
          .eq("id", convite_id)
          .maybeSingle();
        const { error } = await svc.from("convites").delete().eq("id", convite_id);
        if (error) return safeErrorResponse(400, error.message, req);

        await logAction(svc, {
          actorId: userId,
          actorEmail,
          actorRole: "ultra_admin",
          action: "cancel_invite",
          category: "member",
          targetType: "convite",
          targetId: convite_id,
          targetName: conv?.email ?? convite_id,
          empresaId: empresa_id ?? conv?.empresa_id ?? null,
          req,
        });

        return jsonResponse({ success: true }, 200, req);
      }

      if (!isUUID(user_id)) return safeErrorResponse(400, "user_id inválido", req);

      const { data: target } = await svc.from("profiles").select("email, nome, empresa_id").eq("id", user_id).single();

      const { error } = await svc.auth.admin.deleteUser(user_id);
      if (error) return safeErrorResponse(400, error.message, req);

      await logAction(svc, {
        actorId: userId,
        actorEmail,
        actorRole: "ultra_admin",
        action: "delete_user",
        category: "member",
        targetType: "user",
        targetId: user_id,
        targetName: target?.email ?? user_id,
        empresaId: empresa_id ?? target?.empresa_id ?? null,
        req,
      });

      return jsonResponse({ success: true }, 200, req);
    }

    // ─── POST: convidar usuário OU reenviar convite pendente ──────────────
    if (req.method === "POST") {
      const body = await req.json();
      const { empresa_id, email, nome, role, resend, convite_id } = body ?? {};

      const redirectOriginResend = getTrustedOrigin(req);

      // Reenviar convite pendente: renova a validade e reenvia o e-mail
      if (resend && convite_id) {
        if (!isUUID(convite_id)) return safeErrorResponse(400, "convite_id inválido", req);
        if (!redirectOriginResend) return safeErrorResponse(500, "Server CORS misconfigured", req);

        const { data: conv } = await svc
          .from("convites")
          .select("email, nome, empresa_id")
          .eq("id", convite_id)
          .is("usado_em", null)
          .maybeSingle();
        if (!conv) return safeErrorResponse(404, "Convite não encontrado ou já usado", req);

        // Gera um novo token (plaintext não é armazenado) e renova a validade.
        const { data: newToken, error: regenErr } = await svc.rpc("regenerate_convite_token", {
          p_convite_id: convite_id,
        });
        if (regenErr || !newToken) return safeErrorResponse(400, "Falha ao reenviar o convite", req);

        const { error: inviteError } = await svc.auth.admin.inviteUserByEmail(conv.email, {
          redirectTo: `${redirectOriginResend}/profile-setup`,
          data: { invite_token: newToken, nome: conv.nome ?? "" },
        });
        if (inviteError) {
          return safeErrorResponse(
            400,
            isEmailExistsError(inviteError) ? "Esse e-mail já tem conta no Pilar" : "Falha ao reenviar o convite",
            req
          );
        }

        await logAction(svc, {
          actorId: userId,
          actorEmail,
          actorRole: "ultra_admin",
          action: "resend_invite",
          category: "member",
          targetType: "convite",
          targetId: convite_id,
          targetName: conv.email,
          empresaId: conv.empresa_id,
          req,
        });

        return jsonResponse({ success: true }, 200, req);
      }

      if (!isUUID(empresa_id)) return safeErrorResponse(400, "empresa_id inválido", req);
      if (!email || typeof email !== "string") return safeErrorResponse(400, "email obrigatório", req);

      const safeRole = ["admin", "coordenador", "user"].includes(role) ? role : "user";

      const redirectOrigin = getTrustedOrigin(req);
      if (!redirectOrigin) return safeErrorResponse(500, "Server CORS misconfigured", req);

      // Cria o convite guardando SÓ o hash; retorna o plaintext para o e-mail.
      const { data: inviteToken, error: convErr } = await svc.rpc("admin_create_convite", {
        p_empresa_id: empresa_id,
        p_email: email,
        p_cargo: safeRole,
        p_nome: nome || null,
      });

      if (convErr || !inviteToken) return safeErrorResponse(400, convErr?.message ?? "Falha ao criar convite", req);

      const { error: inviteError } = await svc.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${redirectOrigin}/profile-setup`,
        data: { invite_token: inviteToken, nome: nome || "" },
      });

      if (inviteError) {
        // admin_create_convite já grava a linha "pendente" antes do e-mail sair. Sem
        // isto, uma falha de envio deixava a linha órfã pra sempre (mesmo bug do
        // invite-user, corrigido lá no PR #442; faltava aqui).
        await svc
          .from("convites")
          .update({ usado_em: new Date().toISOString() })
          .eq("empresa_id", empresa_id)
          .eq("email", String(email).toLowerCase().trim())
          .is("usado_em", null);
        return safeErrorResponse(
          400,
          isEmailExistsError(inviteError) ? "Esse e-mail já tem conta no Pilar" : "Falha ao enviar convite",
          req
        );
      }

      await logAction(svc, {
        actorId: userId,
        actorEmail,
        actorRole: "ultra_admin",
        action: "invite_user",
        category: "member",
        targetType: "user",
        targetName: nome || email,
        empresaId: empresa_id,
        metadata: { email, role: safeRole },
        req,
      });

      return jsonResponse({ success: true }, 200, req);
    }

    return safeErrorResponse(405, "Method not allowed", req);
  })
);
