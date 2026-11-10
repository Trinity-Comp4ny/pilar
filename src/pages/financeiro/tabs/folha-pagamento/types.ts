export interface ProjetoDetalhe {
  /** Ausente em folhas fechadas antes da regra por conclusão. */
  projeto_id?: string;
  nome: string;
  area_m2: number;
  // Valor do contrato do projeto, base do percentual. Ausente em folhas
  // fechadas antes do percentual existir.
  valor_base?: number;
  /** Dia em que a pessoa concluiu a última disciplina dela no projeto. */
  concluido_em?: string;
}

export interface FolhaItem {
  p_id: string;
  p_nome: string;
  p_cargo: string;
  p_salario_fixo: number;
  p_valor_m2: number;
  // Percentual (0 a 100) sobre o valor dos projetos do mês. Soma com o m².
  p_percentual?: number;
  soma_area: number;
  // Soma dos valores de contrato que servem de base ao percentual.
  soma_valor_base?: number;
  v_variavel: number;
  v_total: number;
  lista_projetos: string[];
  // Snapshot dos projetos que geraram o variável (nome + m²). Vem do RPC no
  // preview e da coluna folha_pagamento.detalhe_projetos na folha fechada.
  detalhe_projetos: ProjetoDetalhe[];
  p_cpf?: string | null;
  p_chave_pix?: string | null;
  status?: string;
  data_pagamento?: string;
  folha_id?: string;
  edited_fields?: string[];
}

export interface HistoryItem {
  mes: number;
  ano: number;
  total: number;
  count: number;
  status: string;
}

export const MONTHS = [
  { value: 1, label: "Janeiro" },
  { value: 2, label: "Fevereiro" },
  { value: 3, label: "Março" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Maio" },
  { value: 6, label: "Junho" },
  { value: 7, label: "Julho" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Setembro" },
  { value: 10, label: "Outubro" },
  { value: 11, label: "Novembro" },
  { value: 12, label: "Dezembro" },
] as const;

export function getMonthLabel(month: number): string {
  return MONTHS.find((m) => m.value === month)?.label ?? "";
}

export function buildYearRange(currentYear: number): number[] {
  return Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
}
