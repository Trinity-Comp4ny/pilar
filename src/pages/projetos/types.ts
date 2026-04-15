import { type ProjectStatus, type ProjectPriority } from "@/constants";

export interface DisciplinaObservacao {
  id: string;
  texto: string;
  usuario: string;
  data: string;
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
}

export function isDiscAtrasada(disc: DisciplinaResponsavel): boolean {
  if (disc.status === "Concluído") return false;
  if (!disc.data_previsao) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const previsao = new Date(disc.data_previsao + "T00:00:00");
  return previsao < hoje;
}

export const getResponsaveisList = (disc: DisciplinaResponsavel): ResponsavelDatas[] => {
  if (disc.responsaveis && disc.responsaveis.length > 0) return disc.responsaveis;
  if (!disc.responsavel_id) return [];
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
  data_inicio: string;
  data_previsao: string;
  data_final?: string;
  localizacao?: string;
  parcelas?: string;
  area_m2?: number;
  status: ProjectStatus;
  prioridade: ProjectPriority;
  valor_contrato: number;
  observacao: string;
  disciplinas: DisciplinaResponsavel[];
}

export const disciplinaStatusOptions = ["Não Iniciado", "Em Andamento", "Concluído", "Pendente"];

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

// Formata data corrigindo o problema de timezone
export const formatDate = (dateString: string | undefined) => {
  if (!dateString) return "-";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("pt-BR");
};

export const formatDateShort = (dateString: string | undefined) => {
  if (!dateString) return "-";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

// Calcula o status de prazo do projeto e status_data
export const getDeadlineStatus = (projeto: { data_previsao?: string; data_final?: string; status: string }) => {
  const { data_previsao, data_final, status } = projeto;

  // Se projeto está concluído, verifica se foi no prazo ou com atraso
  if (status === "Concluído" && data_final && data_previsao) {
    const final = new Date(data_final + "T00:00:00");
    const previsao = new Date(data_previsao + "T00:00:00");

    if (final <= previsao) {
      return {
        label: "Concluído no Prazo",
        color: "bg-green-600 text-white",
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

  if (!data_previsao || status === "Cancelado") {
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
    return { label: "No Prazo", color: "bg-green-500 text-white", days: diffDays, status_data: "no_prazo" };
  }
};

export const getProjectProgress = (disciplinas: DisciplinaResponsavel[]) => {
  if (!disciplinas || disciplinas.length === 0) return 0;
  const completed = disciplinas.filter((d) => d.status === "Concluído").length;
  return Math.round((completed / disciplinas.length) * 100);
};
