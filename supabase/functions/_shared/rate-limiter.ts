/**
 * Rate limiter em memória para Edge Functions.
 *
 * Por que in-memory: Edge Functions Deno têm isolamento de processo por invocação
 * no Supabase — cada instância tem seu próprio mapa. Isso é suficiente para
 * absorver bursts de um único cliente num curto intervalo (window deslizante).
 * Para coordenação cross-instance, usar Redis ou tabela DB (vide check_convite_rate_limit).
 *
 * Casos de uso: funções de email/SMS onde o maior risco é um único user/IP
 * fazendo dezenas de requests em segundos (bugs de UI, scripts automáticos).
 */

interface Window {
  count: number;
  resetAt: number;
}

/** Janela deslizante simples por chave (user_id, ip, empresa_id, etc.) */
export class RateLimiter {
  private windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  /** Retorna true se a chave ainda está dentro do limite. */
  allow(key: string): boolean {
    const now = Date.now();
    let w = this.windows.get(key);

    if (!w || now >= w.resetAt) {
      w = { count: 1, resetAt: now + this.windowMs };
      this.windows.set(key, w);
      return true;
    }

    if (w.count >= this.limit) return false;
    w.count++;
    return true;
  }

  /** Retorna cabeçalhos Retry-After para resposta 429. */
  retryAfterHeaders(key: string): Record<string, string> {
    const w = this.windows.get(key);
    const retryAfterSec = w ? Math.ceil((w.resetAt - Date.now()) / 1000) : 0;
    return {
      "Retry-After": String(Math.max(retryAfterSec, 1)),
      "X-RateLimit-Limit": String(this.limit),
      "X-RateLimit-Remaining": "0",
    };
  }

  /** Limpa entradas expiradas (chamar periodicamente em funções de longa duração). */
  cleanup(): void {
    const now = Date.now();
    for (const [key, w] of this.windows.entries()) {
      if (now >= w.resetAt) this.windows.delete(key);
    }
  }
}

/**
 * Extrai uma chave de rate-limit do request.
 * Ordem de preferência: user_id (autenticado) → X-Forwarded-For → "anonymous"
 */
export function getRateLimitKey(req: Request, userId?: string): string {
  if (userId) return `uid:${userId}`;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return `ip:${forwarded.split(",")[0].trim()}`;
  return "anonymous";
}
