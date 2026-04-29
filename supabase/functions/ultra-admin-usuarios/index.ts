/**
 * Edge function: ultra-admin-usuarios
 *
 * PUT  → atualizar role + features de um usuário (cross-empresa)
 * POST → convidar usuário em nome de outra empresa
 *
 * Requer role = ultra_admin.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { isUUID, jsonResponse, optionsResponse, safeErrorResponse, getTrustedOrigin } from "../_shared/cors.ts";
import { requireUltraAdmin } from "../_shared/admin-auth.ts";
import { logAction } from "../_shared/audit.ts";

const FEATURE_KEYS = new Set([
  "dashboard",
  "relatorios",
  "leads",
  "propostas",
  "clientes",
  "projetos",
  "mapa",
  "financeiro",
  "pessoas",
  "metas",
  "portal_cliente",
  "ai_hub",
  "capacidade",
  "templates",
]);
const VALID_LEVELS = new Set(["viewer", "editor"]);

function sanitizeFeatures(raw: unknown): Record<string, "viewer" | "editor"> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, "viewer" | "editor"> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!FEATURE_KEYS.has(key)) continue;
    if (typeof value !== "string" || !VALID_LEVELS.has(value)) continue;
    result[key] = value as "viewer" | "editor";
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  const auth = await requireUltraAdmin(req);
  if (auth.error) return auth.error;
  const { svc, userId, actorEmail } = auth;

  // ─── PUT: atualizar usuário existente ─────────────────────────────────
  if (req.method === "PUT") {
    const body = await req.json();
    const { user_id, role, features: rawFeatures, empresa_id } = body ?? {};

    if (!isUUID(user_id)) return safeErrorResponse(400, "user_id inválido", req);

    const { data: target, error: targetErr } = await svc
      .from("profiles")
      .select("email, nome, role, empresa_id")
      .eq("id", user_id)
      .single();

    if (targetErr || !target) return safeErrorResponse(404, "Usuário não encontrado", req);

    const safeRole = ["admin", "user"].includes(role) ? role : target.role;
    const safeFeatures = safeRole === "admin" ? {} : sanitizeFeatures(rawFeatures);

    const { error } = await svc.from("profiles").update({ role: safeRole, features: safeFeatures }).eq("id", user_id);

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

  // ─── DELETE: remover usuário ───────────────────────────────────────────
  if (req.method === "DELETE") {
    const body = await req.json();
    const { user_id, empresa_id } = body ?? {};

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

  // ─── POST: convidar usuário para empresa específica ───────────────────
  if (req.method === "POST") {
    const body = await req.json();
    const { empresa_id, email, nome, role, features: rawFeatures } = body ?? {};

    if (!isUUID(empresa_id)) return safeErrorResponse(400, "empresa_id inválido", req);
    if (!email || typeof email !== "string") return safeErrorResponse(400, "email obrigatório", req);

    const safeRole = ["admin", "user"].includes(role) ? role : "user";
    const safeFeatures = safeRole === "admin" ? {} : sanitizeFeatures(rawFeatures);

    const redirectOrigin = getTrustedOrigin(req);
    if (!redirectOrigin) return safeErrorResponse(500, "Server CORS misconfigured", req);

    // Inserir convite diretamente via service_role (bypassa RLS)
    const { data: convite, error: convErr } = await svc
      .from("convites")
      .insert({
        empresa_id,
        email,
        cargo: safeRole,
        nome: nome || null,
        features: safeFeatures,
        criado_por: userId,
      })
      .select("token")
      .single();

    if (convErr || !convite) return safeErrorResponse(400, convErr?.message ?? "Falha ao criar convite", req);

    const { error: inviteError } = await svc.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${redirectOrigin}/profile-setup`,
      data: { invite_token: convite.token, nome: nome || "" },
    });

    if (inviteError) return safeErrorResponse(400, "Falha ao enviar convite", req);

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
});
