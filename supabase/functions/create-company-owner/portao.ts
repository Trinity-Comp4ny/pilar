/**
 * Portão de entrada do create-company-owner (bootstrap de tenant), sem banco nem
 * rede: método, Content-Type, Origin em allowlist e chave de super admin. A ordem
 * importa e é a mesma do index.ts: o que é barato e anônimo é recusado primeiro.
 */
import { safeEqual } from "../_shared/crypto.ts";
import { emailSchema, nameSchema, z } from "../_shared/schemas.ts";

export const createOwnerSchema = z.object({
  email: emailSchema,
  company_name: nameSchema,
  nome: z.string().trim().min(1).max(200).optional(),
});

export interface Requisicao {
  method: string;
  contentType: string | null;
  origin: string | null;
  superAdminKey: string | null;
}

export interface Ambiente {
  allowedOrigins: string;
  superAdminKey: string | undefined;
}

export type Veredito = { ok: true; origin: string } | { ok: false; status: number; error: string; motivo: string };

export function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function verificarRequisicao(req: Requisicao, env: Ambiente): Veredito {
  if (req.method !== "POST") {
    return { ok: false, status: 405, error: "Method not allowed", motivo: "method not allowed" };
  }

  // Content-Type estrito: rejeita form-encoded / multipart (vetor CSRF clássico).
  if (!(req.contentType ?? "").toLowerCase().includes("application/json")) {
    return { ok: false, status: 415, error: "Content-Type must be application/json", motivo: "invalid content-type" };
  }

  // Origin obrigatória e em allowlist (defesa em profundidade pra CSRF).
  const permitidas = parseAllowedOrigins(env.allowedOrigins);
  if (permitidas.length === 0) {
    return { ok: false, status: 500, error: "Server misconfigured", motivo: "ALLOWED_ORIGINS not configured" };
  }
  const origin = (req.origin ?? "").replace(/\/$/, "");
  if (!origin || !permitidas.includes(origin)) {
    return { ok: false, status: 403, error: "Origin not allowed", motivo: "origin not allowed" };
  }

  if (!env.superAdminKey) {
    return { ok: false, status: 500, error: "Server misconfigured", motivo: "SUPER_ADMIN_KEY not configured" };
  }
  // Tempo constante: a chave não vaza byte a byte pelo tempo de resposta.
  if (!req.superAdminKey || !safeEqual(req.superAdminKey, env.superAdminKey)) {
    return { ok: false, status: 401, error: "Unauthorized", motivo: "invalid super admin key" };
  }

  return { ok: true, origin };
}
