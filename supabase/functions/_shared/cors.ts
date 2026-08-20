/**
 * Shared CORS, auth, and response utilities for ALL edge functions.
 *
 * Security:
 *  - ALLOWED_ORIGINS must be configured; empty = reject all cross-origin requests (fail-closed)
 *  - req is REQUIRED in all response helpers to guarantee CORS headers + Vary: Origin
 *  - Bearer token format is validated before forwarding to Supabase
 *  - Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy) applied to every response
 */

import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

let _corsWarningLogged = false;

export function getCorsHeaders(req: Request): Record<string, string> {
  if (!_corsWarningLogged && ALLOWED_ORIGINS.length === 0) {
    console.warn("[cors] ALLOWED_ORIGINS not configured — all cross-origin requests will be rejected");
    _corsWarningLogged = true;
  }

  const origin = (req.headers.get("Origin") ?? "").replace(/\/$/, "");
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    Vary: "Origin",
    ...(allowed !== "null" && { "Access-Control-Allow-Credentials": "true" }),
  };
}

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export function jsonResponse(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      ...SECURITY_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

export function optionsResponse(req: Request): Response {
  return new Response("ok", {
    headers: {
      ...getCorsHeaders(req),
      Vary: "Origin",
    },
  });
}

export function safeErrorResponse(status: number, message: string, req: Request): Response {
  return jsonResponse({ success: false, error: message }, status, req);
}

/**
 * Returns the origin only if it's in the allowlist. Use for redirectTo URLs — never trust Origin header directly.
 */
export function getTrustedOrigin(req: Request): string | null {
  const origin = (req.headers.get("Origin") ?? "").replace(/\/$/, "");
  return ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? null);
}

// ---------------------------------------------------------------------------
// UUID validation (no external dep; formato 8-4-4-4-12 hex, sem exigir
// nibble de versão/variante — os IDs de seed/teste usam placeholders tipo
// 00000000-0000-0000-0000-000000000001, que são UUID válidos pro Postgres
// mas não passam num regex estrito de RFC 4122 v1-5)
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// ---------------------------------------------------------------------------
// Auth — validate Bearer format and return authenticated Supabase client
// ---------------------------------------------------------------------------

type AuthSuccess = { supabase: SupabaseClient; user: User; error?: never };
type AuthFailure = { error: Response; supabase?: never; user?: never };

export async function authenticateUser(req: Request): Promise<AuthSuccess | AuthFailure> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return { error: safeErrorResponse(401, "Authorization token required", req) };
  }

  if (!authHeader.startsWith("Bearer ") || authHeader.length <= "Bearer ".length) {
    return { error: safeErrorResponse(401, "Invalid authorization format", req) };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: safeErrorResponse(401, "User not authenticated", req) };
  }

  return { supabase, user };
}

// ---------------------------------------------------------------------------
// Legacy compatibility — functions still importing `corsHeaders` directly.
// Deprecated: prefer `getCorsHeaders(req)` / `jsonResponse(body, status, req)`.
// ---------------------------------------------------------------------------

/** @deprecated use getCorsHeaders(req) — this does not vary by origin and omits security headers */
export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0] ?? "null",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  Vary: "Origin",
};
