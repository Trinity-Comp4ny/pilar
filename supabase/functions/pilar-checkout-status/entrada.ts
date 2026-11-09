/**
 * O token da sessão de checkout vem do corpo (POST { session_token }). Só texto, com
 * tamanho de token gerado por nós.
 */
export function tokenDaSessao(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const token = bruto.trim();
  return token.length >= 20 && token.length <= 200 ? token : null;
}
