import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { adminClient } from "../_shared/admin-auth.ts";
import { logAction } from "../_shared/audit.ts";
import { withSentry } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";

const log = createLogger("log-impersonation");

type Body = {
  action: "start" | "stop";
  viewAsRole: string;
};

serve(
  withSentry("log-impersonation", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase: supabaseClient, user } = auth;

    try {
      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("role, email, empresa_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) return safeErrorResponse(403, "Profile not found", req);
      if (profile.role !== "admin" && profile.role !== "ultra_admin") {
        return safeErrorResponse(403, "Apenas admins podem usar impersonation", req);
      }

      const body: Body = await req.json();
      const { action, viewAsRole } = body ?? {};

      if (!action || !["start", "stop"].includes(action)) {
        return safeErrorResponse(400, "action deve ser 'start' ou 'stop'", req);
      }
      if (!viewAsRole || typeof viewAsRole !== "string") {
        return safeErrorResponse(400, "viewAsRole obrigatório", req);
      }

      // Cria/encerra sessão server-side autoritativa.
      // Sessão expira em 30min automaticamente; helpers current_effective_role() / is_impersonating()
      // permitem RLS validar o role efetivo sem confiar em localStorage do cliente.
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      const ua = req.headers.get("user-agent") ?? null;

      if (action === "start") {
        const { error: rpcErr } = await supabaseClient.rpc("start_impersonation", {
          p_target_role: viewAsRole,
          p_ip: ip,
          p_user_agent: ua,
        });
        if (rpcErr) {
          return safeErrorResponse(403, rpcErr.message ?? "Falha ao iniciar impersonation", req);
        }
      } else {
        const { error: rpcErr } = await supabaseClient.rpc("stop_impersonation");
        if (rpcErr) {
          return safeErrorResponse(400, rpcErr.message ?? "Falha ao encerrar impersonation", req);
        }
      }

      const svc = adminClient();
      await logAction(svc, {
        actorId: user.id,
        actorEmail: profile.email ?? user.email ?? "",
        actorRole: profile.role as "ultra_admin" | "admin",
        action: action === "start" ? "impersonation_start" : "impersonation_stop",
        category: "impersonation",
        targetType: "role",
        targetName: viewAsRole,
        empresaId: profile.empresa_id ?? null,
        req,
      });

      return jsonResponse({ success: true }, 200, req);
    } catch (error: unknown) {
      log.error("unexpected error", error);
      return safeErrorResponse(400, "Invalid request", req);
    }
  })
);
