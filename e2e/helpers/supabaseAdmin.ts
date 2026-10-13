import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente service role do Supabase LOCAL, só para montar e conferir dados das jornadas
 * ponta a ponta (e2e/jornada-*.spec.ts). O scripts/e2e-local.sh exporta as variáveis;
 * fora dele (staging, máquina sem stack local) as jornadas são puladas.
 */
export const temFuncoesLocais = Boolean(
  process.env.E2E_FUNCTIONS && process.env.E2E_SUPABASE_URL && process.env.E2E_SERVICE_ROLE_KEY
);

export function adminLocal(): SupabaseClient {
  return createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Espera uma condição no banco (o webhook e os triggers são assíncronos para o teste). */
export async function esperar<T>(ler: () => Promise<T>, ok: (v: T) => boolean, tentativas = 20): Promise<T> {
  let v = await ler();
  for (let i = 0; i < tentativas && !ok(v); i++) {
    await new Promise((r) => setTimeout(r, 500));
    v = await ler();
  }
  return v;
}
