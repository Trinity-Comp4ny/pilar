/**
 * Extrai uma mensagem legível de um valor lançado de tipo desconhecido.
 *
 * Supabase/PostgREST rejeitam com um objeto simples (`{ message, code,
 * details, hint }`), NÃO com uma instância de Error. Por isso um teste
 * `err instanceof Error` descarta a mensagem real e o usuário só vê o
 * fallback genérico. Esta função lê `.message` das duas formas antes de
 * cair no fallback, então o erro concreto do PostgREST (ex.: falha de RLS
 * ou de embed) chega até o toast.
 */
export function errorMessage(err: unknown, fallback = "Erro inesperado. Tente novamente."): string {
  if (err instanceof Error) return err.message;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string" &&
    (err as { message: string }).message.length > 0
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}
