import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { authenticateUser, isUUID, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { adminClient } from "../_shared/admin-auth.ts";
import { logAction } from "../_shared/audit.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("delete-user");

serve(
  withSentry("delete-user", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase: supabaseClient, user } = auth;

    try {
      const { data: callerProfile, error: callerError } = await supabaseClient
        .from("profiles")
        .select("empresa_id, role, email")
        .eq("id", user.id)
        .single();

      if (callerError || !callerProfile) return safeErrorResponse(403, "Profile not found", req);
      if (callerProfile.role !== "admin" && callerProfile.role !== "ultra_admin") {
        return safeErrorResponse(403, "Apenas admins podem remover usuários", req);
      }
      if (!callerProfile.empresa_id) return safeErrorResponse(403, "Empresa não encontrada", req);

      const { user_id } = await req.json();
      if (!isUUID(user_id)) return safeErrorResponse(400, "user_id inválido", req);
      if (user_id === user.id) return safeErrorResponse(400, "Não é possível remover a própria conta", req);

      const svc = adminClient();

      // Verificar que o usuário alvo pertence à mesma empresa
      const { data: targetProfile, error: targetError } = await svc
        .from("profiles")
        .select("empresa_id, email, nome")
        .eq("id", user_id)
        .single();

      if (targetError || !targetProfile) return safeErrorResponse(404, "Usuário não encontrado", req);

      // ultra_admin pode remover cross-empresa; admin só da própria
      if (callerProfile.role === "admin" && targetProfile.empresa_id !== callerProfile.empresa_id) {
        return safeErrorResponse(403, "Usuário não pertence à sua empresa", req);
      }

      // Remover do Auth — invalida convites pendentes e sessões ativas
      const { error: authDeleteError } = await svc.auth.admin.deleteUser(user_id);
      if (authDeleteError) {
        log.error("auth.admin.deleteUser failed", authDeleteError, { user_id, actor: user.id });
        return safeErrorResponse(400, `Falha ao remover usuário: ${authDeleteError.message}`, req);
      }

      await logAction(svc, {
        actorId: user.id,
        actorEmail: callerProfile.email ?? user.email ?? "",
        actorRole: callerProfile.role as "ultra_admin" | "admin",
        action: "delete_user",
        category: "member",
        targetType: "user",
        targetId: user_id,
        targetName: targetProfile.email ?? targetProfile.nome ?? user_id,
        empresaId: callerProfile.empresa_id,
        req,
      });

      // profiles deletado em cascata pela FK auth.users → profiles
      return jsonResponse({ success: true }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error);
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
