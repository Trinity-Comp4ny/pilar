/**
 * Quem pode apagar um comentário das Atividades (projeto, disciplina, tarefa).
 *
 * Admin e coordenador moderam: apagam qualquer comentário. Os demais apagam só os
 * próprios. Comentário novo grava `autorId` (id do usuário); os antigos só têm o nome
 * do autor, então caem na comparação por nome.
 */
export interface ComentarioAutoria {
  autor: string;
  autorId?: string;
}

export interface UsuarioComentario {
  id: string | null | undefined;
  role: string | null | undefined;
  /** Nomes pelos quais o usuário pode ter assinado comentários antigos. */
  nomes: (string | null | undefined)[];
}

const PAPEIS_MODERADORES = new Set(["admin", "ultra_admin", "coordenador"]);

export function moderaComentarios(role: string | null | undefined): boolean {
  return !!role && PAPEIS_MODERADORES.has(role);
}

const normalizar = (s: string) => s.trim().toLocaleLowerCase("pt-BR");

export function podeExcluirComentario(c: ComentarioAutoria, usuario: UsuarioComentario): boolean {
  if (moderaComentarios(usuario.role)) return true;
  if (c.autorId) return !!usuario.id && c.autorId === usuario.id;
  const autor = normalizar(c.autor ?? "");
  if (!autor) return false;
  return usuario.nomes.some((n) => !!n && normalizar(n) === autor);
}
