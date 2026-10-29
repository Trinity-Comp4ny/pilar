import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AuthUser = { id: string; last_sign_in_at?: string | null; created_at?: string | null };

export type AcessoAuth = { lastSignInAt: string | null; createdAt: string | null };

const POR_PAGINA = 1000;
// Teto de segurança: 20 mil logins. Muito acima da base atual; evita laço
// infinito se a API devolver página cheia pra sempre.
const MAX_PAGINAS = 20;

/** Mais recente das duas datas ISO (null conta como ausente). */
export function maisRecenteDe(a: string | null, b: string | null): string | null {
  if (!a || !b) return a ?? b;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/**
 * Último acesso de cada usuário (SPEC 117), lido do auth pela Admin API (o schema
 * auth não é exposto ao PostgREST). `last_sign_in_at` só muda em login explícito;
 * quem fica logado renova o token por semanas sem passar por ali. Por isso o valor
 * é o mais recente entre o login e a última renovação de sessão
 * (`ops_ultimo_acesso_usuarios`). Se a RPC falhar, cai só no login. Uso só no
 * portal ultra admin, que já roda com service_role.
 */
export async function listarAcessos(svc: SupabaseClient): Promise<Map<string, AcessoAuth>> {
  const acessos = new Map<string, AcessoAuth>();
  const { data: sessoes } = await svc.rpc("ops_ultimo_acesso_usuarios");
  const sessaoPorUsuario = new Map<string, string>();
  for (const r of (sessoes ?? []) as { user_id: string; ultimo_acesso: string | null }[]) {
    if (r.ultimo_acesso) sessaoPorUsuario.set(r.user_id, r.ultimo_acesso);
  }
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: POR_PAGINA });
    if (error) break;
    const users = (data?.users ?? []) as AuthUser[];
    for (const u of users) {
      acessos.set(u.id, {
        lastSignInAt: maisRecenteDe(u.last_sign_in_at ?? null, sessaoPorUsuario.get(u.id) ?? null),
        createdAt: u.created_at ?? null,
      });
    }
    if (users.length < POR_PAGINA) break;
  }
  return acessos;
}

/** Login mais recente entre os usuários informados (null se ninguém entrou). */
export function ultimoAcesso(userIds: Iterable<string>, acessos: Map<string, AcessoAuth>): string | null {
  let recente: string | null = null;
  for (const id of userIds) {
    recente = maisRecenteDe(recente, acessos.get(id)?.lastSignInAt ?? null);
  }
  return recente;
}
