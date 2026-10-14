import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AuthUser = { id: string; last_sign_in_at?: string | null; created_at?: string | null };

export type AcessoAuth = { lastSignInAt: string | null; createdAt: string | null };

const POR_PAGINA = 1000;
// Teto de segurança: 20 mil logins. Muito acima da base atual; evita laço
// infinito se a API devolver página cheia pra sempre.
const MAX_PAGINAS = 20;

/**
 * Último login de cada usuário (SPEC 117), lido do auth.users pela Admin API
 * (o schema auth não é exposto ao PostgREST). Uso só no portal ultra admin,
 * que já roda com service_role.
 */
export async function listarAcessos(svc: SupabaseClient): Promise<Map<string, AcessoAuth>> {
  const acessos = new Map<string, AcessoAuth>();
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: POR_PAGINA });
    if (error) break;
    const users = (data?.users ?? []) as AuthUser[];
    for (const u of users) {
      acessos.set(u.id, { lastSignInAt: u.last_sign_in_at ?? null, createdAt: u.created_at ?? null });
    }
    if (users.length < POR_PAGINA) break;
  }
  return acessos;
}

/** Login mais recente entre os usuários informados (null se ninguém entrou). */
export function ultimoAcesso(userIds: Iterable<string>, acessos: Map<string, AcessoAuth>): string | null {
  let maisRecente: string | null = null;
  for (const id of userIds) {
    const quando = acessos.get(id)?.lastSignInAt ?? null;
    if (quando && (!maisRecente || quando > maisRecente)) maisRecente = quando;
  }
  return maisRecente;
}
