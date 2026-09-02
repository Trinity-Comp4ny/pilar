import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * `supabase.functions.invoke` devolve `FunctionsHttpError` pra qualquer resposta não-2xx,
 * mas `error.message` é sempre a string fixa "Edge Function returned a non-2xx status code"
 * — o corpo real (`{ error: "..." }`) só existe em `error.context` (a Response bruta),
 * padrão documentado pelo próprio supabase-js. Sem isso, todo 400 legítimo do backend
 * (validação, regra de negócio) vira essa mensagem genérica e inútil pro usuário.
 */
export async function edgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await error.context.json();
      if (body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error) {
        return body.error;
      }
    } catch {
      // corpo não é JSON (ou já foi consumido) — cai no fallback abaixo.
    }
  }
  return fallback;
}
