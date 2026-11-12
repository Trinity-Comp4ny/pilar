/** Regras puras das pastas do projeto no Drive (SPEC 163). */
import { nomeLimpo } from "../_shared/google-drive.ts";

/**
 * Pasta do projeto que aparece no portal do cliente (marcada com para_cliente). O nome diz
 * isso para quem mexe direto pelo Drive (SPEC 164).
 */
export const NOME_PASTA_CLIENTE = "Cliente (visível no portal)";
/** Nome antigo (SPEC 163, até 2026-11-12): as pastas com ele ganham o nome novo. */
export const NOME_PASTA_CLIENTE_ANTIGO = "Cliente";

/**
 * Nome da pasta do projeto: o nome que o escritório deu ("421 - Residência Silva").
 * O código gerado pelo sistema (PRJ-0034) é chave interna e não entra (SPEC 100).
 */
export function nomeDaPastaDoProjeto(nome: string): string {
  return nomeLimpo(nome) || "Projeto";
}

/** Disciplinas do projeto que ainda não têm subpasta no Drive. */
export function pastasQueFaltam(
  disciplinas: { id: string; nome: string }[],
  registradas: { projeto_disciplina_id: string | null }[]
): { id: string; nome: string }[] {
  const comPasta = new Set(registradas.map((r) => r.projeto_disciplina_id).filter(Boolean));
  return disciplinas
    .filter((d) => !comPasta.has(d.id))
    .map((d) => ({ id: d.id, nome: nomeLimpo(d.nome) || "Disciplina" }));
}
