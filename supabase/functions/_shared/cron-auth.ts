import { safeEqual } from "./crypto.ts";

/**
 * Cron chamado com `Authorization: Bearer <CRON_SECRET>`. Comparação em tempo
 * constante, e segredo não configurado nunca autoriza (nem com header vazio).
 */
export function cronAutorizado(headers: Headers, cronSecret: string): boolean {
  if (!cronSecret) return false;
  const token = (headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  return token.length > 0 && safeEqual(token, cronSecret);
}
