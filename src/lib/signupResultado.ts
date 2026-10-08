import type { User } from "@supabase/supabase-js";

/**
 * E-mail que já tem conta: com confirmação de e-mail ligada, o Supabase
 * responde ao signUp com sucesso, não envia nada (evita revelar quem tem
 * conta) e devolve um usuário sem identidades. Sem esta checagem, a tela
 * dizia "Confira seu email" para um e-mail que nunca chega.
 */
export function emailJaTemConta(user: Pick<User, "identities"> | null | undefined): boolean {
  if (!user) return false;
  return Array.isArray(user.identities) && user.identities.length === 0;
}
