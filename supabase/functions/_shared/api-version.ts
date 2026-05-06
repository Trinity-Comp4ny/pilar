/**
 * API versioning helpers for Edge Functions.
 *
 * Strategy: header-based versioning via `X-API-Version` (NOT path-based).
 * - Backward compatible: clients that don't send the header get the current version.
 * - When a client sends `X-API-Version`, we validate it against SUPPORTED_VERSIONS.
 * - All responses include `X-API-Version` so clients can pin to known versions.
 *
 * See `docs/api-versioning.md` for the full strategy and bump policy.
 */

import { getCorsHeaders, SECURITY_HEADERS } from "./cors.ts";

export const API_VERSION = "v1";

/** Versions the server still accepts. Add older versions during deprecation overlap. */
export const SUPPORTED_VERSIONS: readonly string[] = ["v1"];

/**
 * Build a JSON response that advertises the API version via `X-API-Version`.
 * Mirrors `jsonResponse` from cors.ts but adds the version header.
 */
export function versionedResponse(data: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(req),
      ...SECURITY_HEADERS,
      "Content-Type": "application/json",
      "X-API-Version": API_VERSION,
    },
  });
}

export type ApiVersionCheck = { ok: true; version: string } | { ok: false; error: Response };

/**
 * Validate the `X-API-Version` header if the client sent one.
 * Missing header is OK (backward compat) — returns the current API_VERSION.
 * Unsupported header value yields a 400 response so clients fail fast.
 */
export function requireApiVersion(req: Request): ApiVersionCheck {
  const header = req.headers.get("X-API-Version");
  if (!header) {
    return { ok: true, version: API_VERSION };
  }

  const normalized = header.trim().toLowerCase();
  if (!SUPPORTED_VERSIONS.includes(normalized)) {
    const body = {
      success: false,
      error: `Unsupported API version: ${header}. Supported: ${SUPPORTED_VERSIONS.join(", ")}`,
    };
    const error = new Response(JSON.stringify(body), {
      status: 400,
      headers: {
        ...getCorsHeaders(req),
        ...SECURITY_HEADERS,
        "Content-Type": "application/json",
        "X-API-Version": API_VERSION,
      },
    });
    return { ok: false, error };
  }

  return { ok: true, version: normalized };
}
