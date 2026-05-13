/**
 * Schemas zod compartilhados para validação server-side em Edge Functions.
 *
 * Regra: todo payload externo (req.json()) deve passar por um schema antes
 * de tocar DB/Asaas/auth. Nada de `as Payload` direto — TS type assertion
 * não valida em runtime.
 */

import { z } from "https://esm.sh/zod@3.23.8";

export { z };

export const emailSchema = z.string().trim().toLowerCase().email("email inválido").max(320);

export const uuidSchema = z.string().uuid("uuid inválido");

export const cpfCnpjSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 11 || v.length === 14, "CPF/CNPJ deve ter 11 ou 14 dígitos");

export const nameSchema = z.string().trim().min(2, "mínimo 2 caracteres").max(200);

export const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v === "" ? undefined : v));

/** Helper: parse seguro, retorna 400 jsonResponse em caso de erro. */
export function parseOr400<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { ok: true; data: T } | { ok: false; error: string } {
  const r = schema.safeParse(data);
  if (r.success) return { ok: true, data: r.data };
  const first = r.error.issues[0];
  const path = first.path.length ? `${first.path.join(".")}: ` : "";
  return { ok: false, error: `${path}${first.message}` };
}
