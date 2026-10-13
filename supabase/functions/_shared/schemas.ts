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

/** Texto obrigatório com a mesma mensagem para ausente, tipo errado ou vazio. */
export const textoObrigatorio = (mensagem: string, max = 512) =>
  z.string({ required_error: mensagem, invalid_type_error: mensagem }).trim().min(1, mensagem).max(max, mensagem);

/** uuid obrigatório com a mesma mensagem para ausente, tipo errado ou formato. */
export const uuidObrigatorio = (mensagem: string) =>
  z.string({ required_error: mensagem, invalid_type_error: mensagem }).uuid(mensagem);

/**
 * Como parseOr400, mas devolve só a mensagem do primeiro problema: para schemas
 * cujas mensagens já nomeiam o campo ("projeto_id inválido") e que mantêm o texto
 * que a função devolvia antes.
 */
export function validar<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown
): { ok: true; data: z.output<S> } | { ok: false; error: string } {
  // JSON inválido ou corpo que não é objeto: a mensagem do zod ("Expected object,
  // received null") não diz nada a quem chamou.
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Corpo da requisição inválido" };
  }
  const r = schema.safeParse(data);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, error: r.error.issues[0].message };
}

/** Lê o corpo JSON sem lançar: JSON inválido vira null e o schema responde 400. */
export function lerJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}

/**
 * E-mail no formato que o app já aceitava (EMAIL_RE), aparado e limitado. Mesma
 * mensagem para ausente, tipo errado ou formato.
 */
export const emailObrigatorio = (mensagem: string) =>
  z
    .string({ required_error: mensagem, invalid_type_error: mensagem })
    .trim()
    .max(320, mensagem)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, mensagem);

/** Texto opcional: ausente, vazio ou só espaço vira undefined. */
export const textoOpcional = (max: number) =>
  z.preprocess(
    (v) => ((typeof v === "string" && v.trim() === "") || v === null ? undefined : v),
    z.string().trim().max(max).optional()
  );
