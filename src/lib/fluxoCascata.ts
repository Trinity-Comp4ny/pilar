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
 * manual da disciplina.
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
 * spec 071). O grupo seguinte só recebe data_inicio quando todas as
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

/** Nome comparável entre fluxo e projeto: sem acento, sem caixa, sem espaço nas pontas. */
export function normalizarNomeDisciplina(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Data padrão da cascata num projeto existente: o maior entre o início do projeto e hoje. */
export function dataInicioPadraoFluxo(dataInicioProjeto: string | undefined, hoje: string): string {
  if (!dataInicioProjeto) return hoje;
  const inicio = dataInicioProjeto.slice(0, 10);
  return inicio > hoje ? inicio : hoje;
}

export interface DisciplinaNovaDoFluxo {
  nome: string;
  ordem_etapa: number;
  data_inicio: string | null;
  data_fim: string | null;
  checklist_padrao?: FluxoDisciplinaTemplate["checklist_padrao"];
  responsavel_ids: string[];
}

export interface DisciplinaEncaixadaNoFluxo {
  id: string;
  nome: string;
  ordem_etapa: number;
}

export interface PlanoAplicacaoFluxo {
  novas: DisciplinaNovaDoFluxo[];
  encaixadas: DisciplinaEncaixadaNoFluxo[];
}

/**
 * Aplicar um fluxo num projeto que já tem disciplinas (spec 101). Disciplina do
 * fluxo que ainda não existe no projeto vira nova, com cascata de datas,
 * responsáveis e checklist (mesmo resultado do wizard). A que já existe (mesmo
 * nome normalizado) só ganha a coluna: o andamento dela não é reescrito.
 * Disciplina do projeto fora do fluxo não aparece no plano (segue avulsa).
 */
export function planejarAplicacaoFluxo(
  fluxo: FluxoDisciplinaTemplate[],
  existentes: { id: string; nome: string }[],
  dataInicio: string | undefined
): PlanoAplicacaoFluxo {
  const datas = calcularDatasFluxo(fluxo, dataInicio);
  const existentesPorNome = new Map(existentes.map((d) => [normalizarNomeDisciplina(d.nome), d]));
  const jaUsadas = new Set<string>();
  const novas: DisciplinaNovaDoFluxo[] = [];
  const encaixadas: DisciplinaEncaixadaNoFluxo[] = [];

  fluxo.forEach((d, i) => {
    const chave = normalizarNomeDisciplina(d.nome);
    const existente = existentesPorNome.get(chave);
    if (existente && !jaUsadas.has(existente.id)) {
      jaUsadas.add(existente.id);
      encaixadas.push({ id: existente.id, nome: existente.nome, ordem_etapa: d.ordem });
      return;
    }
    novas.push({
      nome: d.nome,
      ordem_etapa: d.ordem,
      data_inicio: datas[i]?.data_inicio ?? null,
      data_fim: datas[i]?.data_previsao ?? null,
      checklist_padrao: d.checklist_padrao,
      responsavel_ids: responsaveisEfetivos(d).ids,
    });
  });

  return { novas, encaixadas };
}
