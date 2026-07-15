/**
 * Extrai uma mensagem útil de um erro de Supabase/RPC. As RPCs do agente usam RAISE EXCEPTION
 * com textos em PT ("A folha de 7/2026 já foi fechada", "Sem permissão para..."), então
 * mostrá-los ao usuário é melhor que um genérico. Cai no fallback para erros de rede sem mensagem.
 */
export function msgErro(e: unknown, fallback = "Tente de novo em instantes."): string {
  if (e && typeof e === "object" && "message" in e) {
    const m = String((e as { message?: unknown }).message ?? "").trim();
    if (m && !/fetch|network|failed to/i.test(m)) return m;
  }
  return fallback;
}
