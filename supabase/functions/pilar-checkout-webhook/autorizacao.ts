/**
 * Quem pode chamar o webhook: só o Asaas, que manda o token compartilhado no header
 * asaas-access-token. Sem o segredo configurado, a função recusa tudo (500) em vez
 * de aceitar qualquer chamada.
 */

import { safeEqual } from "../_shared/crypto.ts";

export type Autorizacao = "ok" | "sem_configuracao" | "nao_autorizado";

export function autorizarWebhook(recebido: string | null, esperado: string | undefined): Autorizacao {
  if (!esperado) return "sem_configuracao";
  if (!recebido || !safeEqual(recebido, esperado)) return "nao_autorizado";
  return "ok";
}
