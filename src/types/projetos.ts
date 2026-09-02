import { type ProjectStatus, type ProjectPriority } from "@/constants";
import { type LinkItem } from "@/components/LinksEditor";
import type { FluxoChecklistItemTemplate } from "@/types/fluxoDisciplinas";

export interface DisciplinaObservacao {
  id: string;
  texto: string;
  usuario: string;
  data: string;
}

/** Comentário estruturado (atividade) da disciplina, com menções opcionais (spec 013). */
export interface DisciplinaComentario {
  id: string;
  texto: string;
  autor: string;
  data: string;
  /** Ids de pessoas marcadas (@menção). Base para notificação futura. */
  mencionados?: string[];
}

export interface ResponsavelDatas {
  responsavel_id: string;
  responsavel_nome: string;
  data_inicio?: string;
  data_previsao?: string;
  data_final?: string;
  status?: string;
}

export interface DisciplinaResponsavel {
  /** ID na tabela relacional projeto_disciplinas. Presente para registros já persistidos. */
  id?: string;
  disciplina: string;
  responsavel_id: string;
  responsavel_nome: string;
  data_inicio?: string;
  data_previsao?: string;
  data_final?: string;
  status?: string;
  prioridade?: ProjectPriority;
  observacoes?: DisciplinaObservacao[];
  responsaveis?: ResponsavelDatas[];
  justificativa_atraso?: string;
  etapa?: number;
  codigo?: string;
  horas_estimadas?: number;
  horas_realizadas?: number;
  descricao?: string;
  labels?: string[];
  links?: LinkItem[];
  comentarios?: DisciplinaComentario[];
  /** Itens de checklist do template do fluxo, propagados até o submit do form de criação. */
  checklist_padrao?: FluxoChecklistItemTemplate[];
}

export function isDiscAtrasada(disc: DisciplinaResponsavel): boolean {
  // data_final preenchida = concluída de fato, independente do campo status
  if (disc.status === "Concluído" || disc.data_final) return false;
  if (!disc.data_previsao) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const previsao = new Date(disc.data_previsao + "T00:00:00");
  return previsao < hoje;
}

export const getDiscDeadlineStatus = (disc: { data_previsao?: string; data_final?: string; status?: string }) => {
  const { data_previsao, data_final, status } = disc;

  // data_final preenchida indica conclusão de fato, mesmo se status não foi atualizado
  const isConcluida = status === "Concluído" || !!data_final;

  if (isConcluida && data_final && data_previsao) {
    const final = new Date(data_final + "T00:00:00");
    const previsao = new Date(data_previsao + "T00:00:00");
    if (final <= previsao) {
      return {
        label: "No Prazo",
        color: "bg-status-done text-white",
        days: 0,
        status_data: "concluido_no_prazo" as const,
      };
    }
    return {
      label: "Com Atraso",
      color: "bg-orange-600 text-white",
      days: 0,
      status_data: "concluido_com_atraso" as const,
    };
  }

  if (!data_previsao || isConcluida) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const previsao = new Date(data_previsao + "T00:00:00");
  previsao.setHours(0, 0, 0, 0);

  const diffTime = previsao.getTime() - hoje.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: "Em Atraso",
      color: "bg-red-500 text-white",
      days: Math.abs(diffDays),
      status_data: "em_atraso" as const,
    };
  }
  if (diffDays <= 7) {
    return { label: "Atenção", color: "bg-yellow-500 text-white", days: diffDays, status_data: "atencao" as const };
  }
  return { label: "No Prazo", color: "bg-status-done text-white", days: diffDays, status_data: "no_prazo" as const };
};

export const getResponsaveisList = (disc: DisciplinaResponsavel): ResponsavelDatas[] => {
  if (disc.responsaveis && disc.responsaveis.length > 0) return disc.responsaveis;
  if (!disc.responsavel_id) {
    if (disc.data_inicio || disc.data_previsao || disc.data_final) {
      return [
        {
          responsavel_id: "",
          responsavel_nome: "",
          data_inicio: disc.data_inicio,
          data_previsao: disc.data_previsao,
          data_final: disc.data_final,
          status: disc.status,
        },
      ];
    }
    return [];
  }
  return [
    {
      responsavel_id: disc.responsavel_id,
      responsavel_nome: disc.responsavel_nome,
      data_inicio: disc.data_inicio,
      data_previsao: disc.data_previsao,
      data_final: disc.data_final,
      status: disc.status,
    },
  ];
};

export interface Projeto {
  id: string;
  codigo_projeto: string;
  nome: string;
  cliente_id: string;
  cliente_nome?: string;
  cliente_email?: string;
  data_inicio: string;
  data_previsao: string;
  data_final?: string;
  localizacao?: string;
  parcelas?: string;
  area_m2?: number;
  status: ProjectStatus;
  /** Coluna do quadro (projeto_etapas). O status deriva do bucket da etapa. */
  etapa_id?: string | null;
  prioridade: ProjectPriority;
  valor_contrato: number;
  observacao: string;
  disciplinas: DisciplinaResponsavel[];
}

export interface ProjetoDisciplinaDB {
  id: string;
  projeto_id: string;
  codigo?: string | null;
  nome: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  data_fim_real: string | null;
  observacoes: string | null;
  prioridade: string | null;
  justificativa_atraso: string | null;
  horas_estimadas: number;
  horas_realizadas?: number;
  custo_hora: number;
  descricao?: string | null;
  labels?: string[];
  links?: LinkItem[];
  comentarios?: DisciplinaComentario[];
  created_at?: string;
  updated_at?: string;
  responsaveis?: Array<{ id: string; nome: string }>;
  ordem_etapa?: number | null;
}

/** Convert relational DB disciplina to the legacy JSONB shape used by UI components */
export function dbDisciplinaToLegacy(d: ProjetoDisciplinaDB): DisciplinaResponsavel {
  const resps: ResponsavelDatas[] = (d.responsaveis || []).map((r) => ({
    responsavel_id: r.id,
    responsavel_nome: r.nome,
    data_inicio: d.data_inicio || undefined,
    data_previsao: d.data_fim || undefined,
    data_final: d.data_fim_real || undefined,
    status: d.status,
  }));

  return {
    id: d.id,
    codigo: d.codigo ?? undefined,
    disciplina: d.nome,
    responsavel_id: resps[0]?.responsavel_id || "",
    responsavel_nome: resps[0]?.responsavel_nome || "",
    data_inicio: d.data_inicio || undefined,
    data_previsao: d.data_fim || undefined,
    data_final: d.data_fim_real || undefined,
    status: d.status,
    prioridade: (d.prioridade as ProjectPriority) || undefined,
    justificativa_atraso: d.justificativa_atraso || undefined,
    horas_estimadas: d.horas_estimadas,
    horas_realizadas: d.horas_realizadas ?? 0,
    descricao: d.descricao ?? undefined,
    responsaveis: resps,
    observacoes: [],
    labels: d.labels ?? [],
    links: d.links ?? [],
    comentarios: d.comentarios ?? [],
    etapa: d.ordem_etapa ?? undefined,
  };
}

export const disciplinaStatusOptions = ["Não Iniciado", "Em Andamento", "Concluído", "Pendente", "Pausada"];

/** Registro de pausa da disciplina (spec 084): motivo obrigatório, quem pausou/retomou.
 *  Só criado/fechado via rpc_pausar_disciplina/rpc_retomar_disciplina, nunca por update direto. */
export interface ProjetoDisciplinaPausa {
  id: string;
  motivo: string;
  pausado_em: string;
  pausado_por_nome: string | null;
  retomado_em: string | null;
  retomado_por_nome: string | null;
}

// Re-export de utilitários centralizados para manter compatibilidade de imports existentes
export { formatCurrency } from "@/lib/currencyUtils";
export { formatDate, formatDateShort } from "@/lib/dateUtils";

// Calcula o status de prazo do projeto e status_data
export const getDeadlineStatus = (projeto: { data_previsao?: string; data_final?: string; status: string }) => {
  const { data_previsao, data_final, status } = projeto;

  // data_final preenchida indica conclusão de fato, mesmo se status não foi atualizado
  const isConcluido = status === "Concluído" || !!data_final;

  if (isConcluido && data_final && data_previsao) {
    const final = new Date(data_final + "T00:00:00");
    const previsao = new Date(data_previsao + "T00:00:00");

    if (final <= previsao) {
      return {
        label: "Concluído no Prazo",
        color: "bg-status-done text-white",
        days: 0,
        status_data: "concluido_no_prazo",
      };
    } else {
      return {
        label: "Concluído com Atraso",
        color: "bg-orange-600 text-white",
        days: 0,
        status_data: "concluido_com_atraso",
      };
    }
  }

  if (!data_previsao || status === "Cancelado" || isConcluido) {
    return null;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const previsao = new Date(data_previsao + "T00:00:00");
  previsao.setHours(0, 0, 0, 0);

  const diffTime = previsao.getTime() - hoje.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "Em Atraso", color: "bg-red-500 text-white", days: Math.abs(diffDays), status_data: "em_atraso" };
  } else if (diffDays <= 7) {
    return { label: "Atenção", color: "bg-yellow-500 text-white", days: diffDays, status_data: "atencao" };
  } else {
    return { label: "No Prazo", color: "bg-status-done text-white", days: diffDays, status_data: "no_prazo" };
  }
};

export const getProjectProgress = (disciplinas: DisciplinaResponsavel[]) => {
  if (!disciplinas || disciplinas.length === 0) return 0;

  const isConcluida = (d: DisciplinaResponsavel) => d.status === "Concluído";

  // Pondera pelas horas estimadas quando houver; assim uma disciplina grande pesa mais
  // que uma pequena. Sem horas registradas, cai para contagem simples de disciplinas.
  const totalHoras = disciplinas.reduce((acc, d) => acc + (d.horas_estimadas || 0), 0);
  if (totalHoras > 0) {
    const concluidasHoras = disciplinas.filter(isConcluida).reduce((acc, d) => acc + (d.horas_estimadas || 0), 0);
    return Math.round((concluidasHoras / totalHoras) * 100);
  }

  const completed = disciplinas.filter(isConcluida).length;
  return Math.round((completed / disciplinas.length) * 100);
};
