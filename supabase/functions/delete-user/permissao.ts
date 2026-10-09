/**
 * Quem pode remover quem (delete-user), sem banco nem rede. O index.ts lê os dois
 * profiles no banco (nunca no JWT) e pergunta aqui.
 */

export interface PerfilAutor {
  empresa_id: string | null;
  role: string | null;
}

export interface PerfilAlvo {
  empresa_id: string | null;
  role: string | null;
}

export type Recusa = { status: number; error: string };

/** Só admin ou ultra_admin, e com empresa, remove usuário. */
export function recusaDoAutor(autor: PerfilAutor | null): Recusa | null {
  if (!autor) return { status: 403, error: "Profile not found" };
  if (autor.role !== "admin" && autor.role !== "ultra_admin") {
    return { status: 403, error: "Apenas admins podem remover usuários" };
  }
  if (!autor.empresa_id) return { status: 403, error: "Empresa não encontrada" };
  return null;
}

/**
 * ultra_admin remove qualquer um, de qualquer empresa. admin só remove gente da
 * própria empresa, e nunca um ultra_admin (conta de plataforma, mesmo que vinculada
 * à empresa dele).
 */
export function recusaDoAlvo(autor: PerfilAutor, alvo: PerfilAlvo): Recusa | null {
  if (autor.role === "ultra_admin") return null;
  if (alvo.empresa_id !== autor.empresa_id) return { status: 403, error: "Usuário não pertence à sua empresa" };
  if (alvo.role === "ultra_admin") return { status: 403, error: "Apenas ultra admin pode remover este usuário" };
  return null;
}
