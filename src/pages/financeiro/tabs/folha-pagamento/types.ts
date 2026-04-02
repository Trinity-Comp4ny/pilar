export interface FolhaItem {
  p_id: string;
  p_nome: string;
  p_cargo: string;
  p_salario_fixo: number;
  p_valor_m2: number;
  soma_area: number;
  v_variavel: number;
  v_total: number;
  lista_projetos: string[];
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
