import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { adminClient } from "../_shared/admin-auth.ts";
import { logAction } from "../_shared/audit.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";
import { checkDbRateLimit } from "../_shared/db-rate-limit.ts";
import { parseOr400, uuidSchema, z } from "../_shared/schemas.ts";

const deleteUserSchema = z.object({ user_id: uuidSchema });

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

      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return safeErrorResponse(400, "JSON inválido", req);
      }
      const parsed = parseOr400(deleteUserSchema, raw);
      if (!parsed.ok) return safeErrorResponse(400, parsed.error, req);
      const { user_id } = parsed.data;
      if (user_id === user.id) return safeErrorResponse(400, "Não é possível remover a própria conta", req);

      const svc = adminClient();

      // Rate limit por actor — admin comprometido não pode varrer a empresa em massa
      const rl = await checkDbRateLimit(svc, {
        bucket: "delete_user",
        key: `uid:${user.id}`,
        max: 10,
        windowSeconds: 3600,
      });
      if (rl.rpcError) {
        log.error("rate limit check failed — fail-closed", null, { rpcError: rl.rpcError });
        return safeErrorResponse(503, "Serviço indisponível", req);
      }
      if (!rl.allowed) {
        return safeErrorResponse(429, "Muitas remoções em sequência. Aguarde antes de tentar novamente.", req);
      }

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
