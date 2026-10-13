import { emailObrigatorio, validar, z } from "../_shared/schemas.ts";

/** Papéis que o ultra admin atribui por aqui (ADR 0029/0034); financeiro é eixo à parte. */
export const PAPEIS_ATRIBUIVEIS = ["admin", "coordenador", "user"] as const;

/** Papel pedido, se for atribuível; senão o padrão (nunca ultra_admin por esta rota). */
export function papelSeguro(pedido: unknown, padrao: string): string {
  return PAPEIS_ATRIBUIVEIS.find((p) => p === pedido) ?? padrao;
}

export const conviteSchema = z.object({ email: emailObrigatorio("email obrigatório") });

/** E-mail do convite normalizado (aparado, minúsculo) ou o erro de sempre. */
export function emailDoConvite(email: unknown): { ok: true; email: string } | { ok: false; error: string } {
  const r = validar(conviteSchema, { email });
  return r.ok ? { ok: true, email: r.data.email.toLowerCase() } : r;
}
