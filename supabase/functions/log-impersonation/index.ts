import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { adminClient } from "../_shared/admin-auth.ts";
import { logAction } from "../_shared/audit.ts";

type Body = {
  action: "start" | "stop";
  viewAsRole: string;
};

serve(async (req) => {
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
    console.error("[log-impersonation] unexpected error", error);
    return safeErrorResponse(400, "Invalid request", req);
  }
});
