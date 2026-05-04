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

// Apenas admin/user via UI. ultra_admin é exclusivo via SQL direto.
// Roles legados (financeiro/marketing/operacional) caem no fallback 'user'.
const ASSIGNABLE_ROLES = ["admin", "user"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const FEATURE_KEYS = new Set([
  "dashboard",
  "relatorios",
  "leads",
  "propostas",
  "clientes",
  "projetos",
  "planejamento",
  "timesheet",
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

serve(
  withSentry("invite-user", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

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

      const body = await req.json();
      const { email, nome, role, features: rawFeatures } = body ?? {};

      if (!email || !EMAIL_RE.test(String(email))) {
        return safeErrorResponse(400, "Invalid email format", req);
      }

      const safeRole: AssignableRole = ASSIGNABLE_ROLES.includes(role) ? role : "user";
      const safeFeatures = safeRole === "admin" ? {} : sanitizeFeatures(rawFeatures);

      const redirectOrigin = getTrustedOrigin(req);
      if (!redirectOrigin) return safeErrorResponse(500, "Server CORS misconfigured", req);

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
        p_features: safeFeatures,
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
        return safeErrorResponse(400, "Falha ao enviar convite", req);
      }

      const svc = adminClient();
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
