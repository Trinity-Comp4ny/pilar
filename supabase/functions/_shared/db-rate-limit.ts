/**
 * Rate limit DB-backed via RPC `check_rate_limit(p_bucket, p_key, p_max, p_window)`.
 *
 * Atomic, cross-instance (tabela `rate_limit_attempts`). Use em endpoints sensíveis
 * onde o `_shared/rate-limiter.ts` in-memory não é suficiente — checkout, signup,
 * delete-user, super-admin, etc.
 *
 * Fail-closed por padrão: erro de RPC → bloqueia request (mais seguro que liberar).
 */

import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitOptions {
  /** Identificador do bucket — ex: "checkout_create", "delete_user". */
  bucket: string;
  /** Chave única por cliente — IP, user_id, email, etc. */
  key: string;
  /** Máximo de tentativas dentro da janela. */
  max: number;
  /** Janela em segundos. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Se false e error preenchido, RPC falhou — fail-closed. */
  rpcError?: string;
}

export async function checkDbRateLimit(svc: SupabaseClient, opts: RateLimitOptions): Promise<RateLimitResult> {
  const { data, error } = await svc.rpc("check_rate_limit", {
    p_bucket: opts.bucket,
    p_key: opts.key,
    p_max: opts.max,
    p_window: opts.windowSeconds,
  });

  if (error) {
    return { allowed: false, rpcError: error.message };
  }

  return { allowed: data === true };
}

/** Extrai key padrão para rate limit: user_id > IP > "anonymous". */
export function getClientKey(req: Request, userId?: string | null): string {
  if (userId) return `uid:${userId}`;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return `ip:${forwarded.split(",")[0].trim()}`;
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return `ip:${realIp.trim()}`;
  return "anonymous";
}
