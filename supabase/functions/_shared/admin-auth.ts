/**
 * Shared admin auth utilities for Pilar edge functions.
 *
 * Regra de ouro (evita a classe SEC-11): o papel é sempre lido NO BANCO
 * (profiles.role) via service_role — NUNCA confiando no JWT/metadata.
 *
 *   ultra_admin → acesso de plataforma, cross-empresa
 *   owner       → dono da empresa; equivalente a admin para operações admin
 *   admin       → acesso administrativo da empresa, escopado por empresa_id
 *   coordenador / colaborador / user → sem acesso administrativo
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateUser, safeErrorResponse } from "./cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = "user" | "admin" | "ultra_admin" | "owner" | "coordenador" | "colaborador";

export type RoleSuccess = {
  svc: SupabaseClient;
  userId: string;
  actorEmail: string;
  actorRole: UserRole;
  empresaId: string | null;
  error?: never;
};

type AdminSuccess = {
  svc: SupabaseClient;
  userId: string;
  actorEmail: string;
  actorRole: "ultra_admin" | "admin";
  empresaId: string | null;
  error?: never;
};

type AdminFailure = { error: Response; svc?: never; userId?: never };

/**
 * Admin da própria empresa (admin ou ultra_admin com empresa_id), para as funções
 * que já leram o profile e só precisam decidir. `owner` fica de fora de propósito:
 * foi migrado para `admin` (20260870000000) e não é mais atribuído.
 */
export function ehAdminDaEmpresa<P extends { empresa_id: string | null; role: string | null }>(
  profile: P | null | undefined
): profile is P & { empresa_id: string } {
  return !!profile?.empresa_id && (profile.role === "admin" || profile.role === "ultra_admin");
}

/**
 * Nível de autenticação (`aal`) do JWT: "aal1" só senha, "aal2" com segundo fator.
 * Só é lido DEPOIS de authenticateUser, que já validou assinatura e validade do token no
 * Auth; aqui não se verifica nada, só se decodifica o payload.
 */
export function aalDoToken(authHeader: string | null): string | null {
  const token = (authHeader ?? "").replace(/^Bearer\s+/i, "");
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return typeof json?.aal === "string" ? json.aal : null;
  } catch {
    return null;
  }
}

/**
 * ADR 0031: o acesso entre empresas do ultra_admin exige segundo fator. Configuração
 * ausente conta como ligada: só `false` explícito (dev local e E2E) dispensa.
 */
export function mfaDispensado(exigirMfaUltraAdmin: boolean | null | undefined): boolean {
  return exigirMfaUltraAdmin === false;
}

// ---------------------------------------------------------------------------
// Primitivo reutilizável: exige que o papel do caller (lido no banco) esteja
// na allowlist. Base de todos os gates abaixo.
// ---------------------------------------------------------------------------

export async function requireRole(
  req: Request,
  allowedRoles: readonly UserRole[]
): Promise<RoleSuccess | AdminFailure> {
  const auth = await authenticateUser(req);
  if (auth.error) return { error: auth.error };

  const svc = adminClient();
  const { data: profile, error } = await svc
    .from("profiles")
    .select("role, email, empresa_id")
    .eq("id", auth.user.id)
    .single();

  if (error || !profile) {
    return { error: safeErrorResponse(403, "Profile not found", req) };
  }

  if (!allowedRoles.includes(profile.role as UserRole)) {
    return { error: safeErrorResponse(403, "Insufficient role", req) };
  }

  return {
    svc,
    userId: auth.user.id,
    actorEmail: profile.email ?? "",
    actorRole: profile.role as UserRole,
    empresaId: profile.empresa_id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Ultra admin gate (cross-empresa)
// ---------------------------------------------------------------------------

export async function requireUltraAdmin(req: Request): Promise<AdminSuccess | AdminFailure> {
  const result = await requireRole(req, ["ultra_admin"]);
  if (result.error) return { error: result.error };

  const { data: config } = await result.svc
    .from("platform_settings")
    .select("exigir_mfa_ultra_admin")
    .eq("id", "default")
    .maybeSingle();
  if (!mfaDispensado(config?.exigir_mfa_ultra_admin) && aalDoToken(req.headers.get("Authorization")) !== "aal2") {
    return { error: safeErrorResponse(403, "MFA required", req) };
  }

  return { ...result, actorRole: "ultra_admin" };
}

// ---------------------------------------------------------------------------
// Company admin gate (aceita ultra_admin, owner ou admin).
// owner e admin são reportados como "admin" para fins de auditoria/escopo.
// ---------------------------------------------------------------------------

export async function requireAdmin(req: Request): Promise<AdminSuccess | AdminFailure> {
  const result = await requireRole(req, ["ultra_admin", "owner", "admin"]);
  if (result.error) return { error: result.error };

  if (result.actorRole !== "ultra_admin" && result.empresaId === null) {
    return { error: safeErrorResponse(403, "Admin must belong to a company", req) };
  }

  return {
    ...result,
    actorRole: result.actorRole === "ultra_admin" ? "ultra_admin" : "admin",
  };
}
