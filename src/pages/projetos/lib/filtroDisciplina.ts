import { PROJECT_PRIORITY, type ProjectPriority } from "@/constants";
import type { DisciplinaResponsavel, Projeto } from "@/types/projetos";

/**
 * Critérios do filtro de Projetos que valem POR DISCIPLINA: prioridade, pessoa e
 * disciplina do catálogo. Juntos numa só checagem, "Larissa + Alta" acha a
 * disciplina da Larissa que é alta, e não um projeto alto onde a Larissa cuida
 * de outra coisa.
 */
export interface CriteriosDisciplina {
  prioridades: ProjectPriority[];
  pessoaIds: string[];
  /** Nomes do catálogo, já em minúsculas. */
  disciplinaNomes: Set<string>;
}

export function temCriterioDeDisciplina(c: CriteriosDisciplina): boolean {
  return c.prioridades.length > 0 || c.pessoaIds.length > 0 || c.disciplinaNomes.size > 0;
}

/** Prioridade que vale para a disciplina: a dela; sem ela, a do projeto. */
export function prioridadeEfetiva(disc: DisciplinaResponsavel, projeto: Projeto): ProjectPriority {
  return disc.prioridade || projeto.prioridade || PROJECT_PRIORITY.MEDIA;
}

export function disciplinaAtende(disc: DisciplinaResponsavel, projeto: Projeto, c: CriteriosDisciplina): boolean {
  if (c.prioridades.length > 0 && !c.prioridades.includes(prioridadeEfetiva(disc, projeto))) return false;
  if (c.pessoaIds.length > 0) {
    const daPessoa =
      c.pessoaIds.includes(disc.responsavel_id || "") ||
      (disc.responsaveis?.some((r) => c.pessoaIds.includes(r.responsavel_id)) ?? false);
    if (!daPessoa) return false;
  }
  if (c.disciplinaNomes.size > 0 && !c.disciplinaNomes.has((disc.disciplina || "").toLowerCase())) return false;
  return true;
}

/**
 * O projeto passa quando ao menos uma disciplina atende a todos os critérios.
 * Projeto sem disciplina só pode passar pelo filtro de prioridade (vale a dele).
 */
export function projetoAtendeDisciplinas(projeto: Projeto, c: CriteriosDisciplina): boolean {
  if (!temCriterioDeDisciplina(c)) return true;
  const discs = projeto.disciplinas ?? [];
  if (discs.length === 0) {
    if (c.pessoaIds.length > 0 || c.disciplinaNomes.size > 0) return false;
    return c.prioridades.includes(projeto.prioridade || PROJECT_PRIORITY.MEDIA);
  }
  return discs.some((d) => disciplinaAtende(d, projeto, c));
}

/** Para a aba Disciplinas: mantém só as disciplinas que atendem aos critérios. */
export function recortarDisciplinas(projetos: Projeto[], c: CriteriosDisciplina): Projeto[] {
  if (!temCriterioDeDisciplina(c)) return projetos;
  return projetos.map((p) => {
    const discs = (p.disciplinas ?? []).filter((d) => disciplinaAtende(d, p, c));
    return discs.length === (p.disciplinas ?? []).length ? p : { ...p, disciplinas: discs };
  });
}
