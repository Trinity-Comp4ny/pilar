import { addBusinessDays, formatDateLocal, parseDateLocal } from "@/lib/businessDays";
import type { FluxoDisciplinaTemplate } from "@/types/fluxoDisciplinas";

export interface DisciplinaComDatas {
  ordem: number;
  nome: string;
  data_inicio?: string;
  data_previsao?: string;
}

type DisciplinaParaDuracao = Pick<FluxoDisciplinaTemplate, "duracao_dias_uteis" | "checklist_padrao">;

/**
 * Duração efetiva de uma disciplina: soma dos itens de checklist que têm
 * duracao_dias_uteis definida. Sem nenhum item com duração, cai no campo
 * manual da disciplina. `horas_estimadas` de um item é sempre decorativo,
 * nunca entra nessa soma (ver spec 067, "Fora de escopo").
 */
export function duracaoEfetiva(disciplina: DisciplinaParaDuracao): number | undefined {
  const itensComDias = (disciplina.checklist_padrao ?? []).filter(
    (item) => typeof item.duracao_dias_uteis === "number" && item.duracao_dias_uteis > 0
  );
  if (itensComDias.length > 0) {
    return itensComDias.reduce((soma, item) => soma + (item.duracao_dias_uteis ?? 0), 0);
  }
  return disciplina.duracao_dias_uteis;
}

type DisciplinaParaResponsaveis = Pick<
  FluxoDisciplinaTemplate,
  "responsaveis_ids" | "responsaveis_nomes" | "checklist_padrao"
>;

export interface ResponsaveisEfetivos {
  ids: string[];
  nomes: string[];
}

/**
 * Responsáveis efetivos de uma disciplina: união (sem duplicar) dos responsáveis
 * das tarefas do checklist que têm algum. Sem nenhuma tarefa com responsável,
 * cai no fallback manual da disciplina (mesmo padrão de duracaoEfetiva).
 */
export function responsaveisEfetivos(disciplina: DisciplinaParaResponsaveis): ResponsaveisEfetivos {
  const itensComResponsavel = (disciplina.checklist_padrao ?? []).filter(
    (item) => (item.responsaveis_ids ?? []).length > 0
  );

  if (itensComResponsavel.length > 0) {
    const ids: string[] = [];
    const nomes: string[] = [];
    for (const item of itensComResponsavel) {
      (item.responsaveis_ids ?? []).forEach((id, i) => {
        if (ids.includes(id)) return;
        ids.push(id);
        nomes.push(item.responsaveis_nomes?.[i] ?? "");
      });
    }
    return { ids, nomes };
  }

  return { ids: disciplina.responsaveis_ids ?? [], nomes: disciplina.responsaveis_nomes ?? [] };
}

type DisciplinaParaCascata = Pick<
  FluxoDisciplinaTemplate,
  "ordem" | "nome" | "duracao_dias_uteis" | "checklist_padrao"
>;

/**
 * Cascata de datas por disciplina de fluxo, agrupada por `ordem` (disciplinas
 * com o mesmo `ordem` rodam em paralelo, sem entidade "etapa" nomeada — ver
 * spec 067). O grupo seguinte só recebe data_inicio quando todas as
 * disciplinas do grupo anterior tiverem data_previsao calculada; a maior
 * data_previsao entre elas manda (a mais lenta do grupo). Disciplina sem
 * duração efetiva fica sem data_previsao e não participa desse "maior".
 */
export function calcularDatasFluxo(
  disciplinas: DisciplinaParaCascata[],
  dataInicioProjeto: string | undefined
): DisciplinaComDatas[] {
  const base = disciplinas.map((d) => ({ ordem: d.ordem, nome: d.nome }));
  if (!dataInicioProjeto) return base;

  const porIndice = new Map<number, DisciplinaComDatas>();
  const ordens = Array.from(new Set(disciplinas.map((d) => d.ordem))).sort((a, b) => a - b);
  let cursorInicio: string | undefined = dataInicioProjeto;

  for (const ordem of ordens) {
    let maiorPrevisao: string | undefined;

    disciplinas.forEach((d, i) => {
      if (d.ordem !== ordem) return;
      const inicio = cursorInicio;
      const duracao = duracaoEfetiva(d);
      let previsao: string | undefined;
      if (inicio && duracao && duracao > 0) {
        previsao = formatDateLocal(addBusinessDays(parseDateLocal(inicio), duracao));
        if (!maiorPrevisao || previsao > maiorPrevisao) maiorPrevisao = previsao;
      }
      porIndice.set(i, { ordem, nome: d.nome, data_inicio: inicio, data_previsao: previsao });
    });

    cursorInicio = maiorPrevisao;
  }

  return disciplinas.map((d, i) => porIndice.get(i) ?? { ordem: d.ordem, nome: d.nome });
}
