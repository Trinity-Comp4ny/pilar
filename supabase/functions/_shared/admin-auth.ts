/**
 * Shared admin auth utilities for Pilar edge functions.
 *
 * Uses profiles.role instead of users.account_type (Labrynth pattern).
 *   ultra_admin → platform-level access, cross-company
 *   admin       → company-level access, scoped to empresa_id
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

type AdminSuccess = {
  svc: SupabaseClient;
  userId: string;
  actorEmail: string;
  actorRole: "ultra_admin" | "admin";
  empresaId: string | null;
  error?: never;
};
type AdminFailure = { error: Response; svc?: never; userId?: never };

// ---------------------------------------------------------------------------
// Ultra admin gate (cross-company access)
// ---------------------------------------------------------------------------

export async function requireUltraAdmin(req: Request): Promise<AdminSuccess | AdminFailure> {
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

  if (profile.role !== "ultra_admin") {
    return { error: safeErrorResponse(403, "Ultra admin access required", req) };
  }

  return {
    svc,
    userId: auth.user.id,
    actorEmail: profile.email ?? "",
    actorRole: "ultra_admin",
    empresaId: profile.empresa_id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Company admin gate (accepts ultra_admin OR admin)
// ---------------------------------------------------------------------------

export async function requireAdmin(req: Request): Promise<AdminSuccess | AdminFailure> {
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

  if (profile.role !== "ultra_admin" && profile.role !== "admin") {
    return { error: safeErrorResponse(403, "Admin access required", req) };
  }

  if (profile.role === "admin" && !profile.empresa_id) {
    return { error: safeErrorResponse(403, "Admin must belong to a company", req) };
  }

  return {
    svc,
    userId: auth.user.id,
    actorEmail: profile.email ?? "",
    actorRole: profile.role as "ultra_admin" | "admin",
    empresaId: profile.empresa_id ?? null,
  };
}
