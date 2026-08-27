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
