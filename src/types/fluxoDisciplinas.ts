export interface FluxoChecklistItemTemplate {
  texto: string;
  /** Dias úteis que este item consome; participa da soma que vira a duração da disciplina. */
  duracao_dias_uteis?: number;
  /** Responsáveis pela tarefa. Quando algum item da disciplina tem responsável, a
   *  disciplina não usa mais `responsaveis_ids` manual — vira a união dos das tarefas. */
  responsaveis_ids?: string[];
  responsaveis_nomes?: string[];
}

export interface FluxoDisciplinaTemplate {
  /** Posição/coluna no fluxo. Disciplinas com o mesmo `ordem` rodam em paralelo. */
  ordem: number;
  nome: string;
  /** Fallback manual, usado só quando nenhuma tarefa do checklist tem responsável. */
  responsaveis_ids?: string[];
  responsaveis_nomes?: string[];
  /** Duração em dias úteis. Ignorada se `checklist_padrao` tiver algum item com duracao_dias_uteis. */
  duracao_dias_uteis?: number;
  /** Itens de checklist padrão, copiados para a disciplina ao aplicar o fluxo num projeto. */
  checklist_padrao?: FluxoChecklistItemTemplate[];
}

/** Formato legado (spec 051): etapa nomeada agrupando disciplinas, responsável único. */
interface FluxoEtapaLegadoDisciplina {
  nome: string;
  responsavel_id?: string;
  responsavel_nome?: string;
  checklist_padrao?: string[];
}

interface FluxoEtapaLegado {
  ordem: number;
  nome: string;
  disciplinas: (string | FluxoEtapaLegadoDisciplina)[];
  duracao_dias_uteis?: number;
}

function isFormatoLegado(arr: unknown[]): arr is FluxoEtapaLegado[] {
  const first = arr[0] as FluxoEtapaLegado | undefined;
  return Array.isArray(first?.disciplinas);
}

function comOrdemGarantida(itens: FluxoDisciplinaTemplate[]): FluxoDisciplinaTemplate[] {
  return itens.map((d, i) => ({
    ...d,
    ordem: typeof d.ordem === "number" && Number.isFinite(d.ordem) ? d.ordem : i + 1,
  }));
}

/**
 * Achata o formato legado (spec 051: etapa nomeada → disciplinas dentro, um
 * responsável, checklist só texto) para a lista flat de disciplinas (spec 071).
 * Fluxos já no formato novo passam só pela garantia de `ordem`. Disciplina sem
 * `ordem` reconhecível vai pro fim da lista em vez de quebrar a tela.
 */
export function normalizeFluxoDisciplinas(raw: unknown): FluxoDisciplinaTemplate[] {
  const arr = Array.isArray(raw) ? raw : [];
  if (arr.length === 0) return [];
  if (!isFormatoLegado(arr)) return comOrdemGarantida(arr as FluxoDisciplinaTemplate[]);

  const flat = arr.flatMap((etapa, ei) => {
    const ordem = typeof etapa.ordem === "number" ? etapa.ordem : ei + 1;
    return (etapa.disciplinas || []).map((d) => {
      const disc = typeof d === "string" ? { nome: d } : d;
      return {
        ordem,
        nome: disc.nome,
        responsaveis_ids: disc.responsavel_id ? [disc.responsavel_id] : undefined,
        responsaveis_nomes: disc.responsavel_nome ? [disc.responsavel_nome] : undefined,
        duracao_dias_uteis: etapa.duracao_dias_uteis,
        checklist_padrao: disc.checklist_padrao?.map((texto) => ({ texto })),
      };
    });
  });

  return comOrdemGarantida(flat);
}

export interface FluxoDisciplinas {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  disciplinas: FluxoDisciplinaTemplate[];
  ativo: boolean;
  created_at: string;
}

export interface FluxoInsert {
  nome: string;
  descricao?: string;
  disciplinas: FluxoDisciplinaTemplate[];
}
