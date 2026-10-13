import { safeEqual } from "../_shared/crypto.ts";
import { uuidObrigatorio, validar, z } from "../_shared/schemas.ts";

export const entradaSchema = z.object({ request_id: uuidObrigatorio("request_id inválido") });

export const lerEntrada = (corpo: unknown) => validar(entradaSchema, corpo);

/** Compara em tempo constante; segredo não configurado nunca confere. */
export function segredoConfere(recebido: string, esperado: string): boolean {
  return !!esperado && safeEqual(recebido, esperado);
}

/** Quem pode disparar: chamada server-side com a service role ou com o segredo compartilhado. */
export function chamadorAutorizado(
  headers: Headers,
  segredos: { serviceRoleKey: string; sharedSecret: string }
): boolean {
  const auth = headers.get("Authorization") ?? "";
  if (segredos.serviceRoleKey && segredoConfere(auth, `Bearer ${segredos.serviceRoleKey}`)) return true;
  return segredoConfere(headers.get("x-pilar-secret") ?? "", segredos.sharedSecret);
}
