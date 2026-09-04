import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * Mensagem legível de um erro de `supabase.functions.invoke`.
 *
 * As edge functions respondem `{ success: false, error: "<mensagem>" }` via
 * `safeErrorResponse`. O supabase-js embrulha isso num FunctionsHttpError com o
 * Response em `context`; sem ler o corpo, o front só tem "Edge Function returned
 * a non-2xx status code", que não diz ao usuário o que fazer.
 */
export async function mensagemDaFunction(error: unknown, fallback: string): Promise<string> {
  if (!(error instanceof FunctionsHttpError)) return fallback;
  try {
    const corpo = (await error.context.json()) as { error?: string } | null;
    return corpo?.error?.trim() || fallback;
  } catch {
    return fallback;
  }
}

/** Status HTTP do erro de invoke, se houver. */
export function statusDaFunction(error: unknown): number | undefined {
  return error instanceof FunctionsHttpError ? error.context.status : undefined;
}
