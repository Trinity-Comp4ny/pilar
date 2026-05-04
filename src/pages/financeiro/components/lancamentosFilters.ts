import { format, endOfMonth, endOfYear, startOfMonth, startOfYear, subMonths } from "date-fns";

export type Periodo = "mes-atual" | "mes-anterior" | "ultimos-30" | "ano" | "tudo";
export type TipoFilter = "todos" | "receita" | "despesa";
export type StatusFilter = "todos" | "pagos" | "pendentes" | "atrasados";
export type QuickFilter = "mes-atual" | "vence-hoje" | "atrasados" | "pendentes";

export interface LancamentosFilters {
  search: string;
  tipo: TipoFilter;
  status: StatusFilter;
  periodo: Periodo | "custom";
  customFrom: string | null;
  customTo: string | null;
  categorias: string[];
  projetos: string[];
  clientes: string[];
  fornecedores: string[];
  formasPagamento: string[];
  valorMin: string;
  valorMax: string;
}

export const defaultFilters: LancamentosFilters = {
  search: "",
  tipo: "todos",
  status: "todos",
  periodo: "mes-atual",
  customFrom: null,
  customTo: null,
  categorias: [],
  projetos: [],
  clientes: [],
  fornecedores: [],
  formasPagamento: [],
  valorMin: "",
  valorMax: "",
};

export function periodoRange(filters: LancamentosFilters): { from: string | null; to: string | null } {
  if (filters.periodo === "custom") {
    return { from: filters.customFrom, to: filters.customTo };
  }
  const today = new Date();
  if (filters.periodo === "tudo") return { from: null, to: null };
  if (filters.periodo === "mes-atual")
    return { from: format(startOfMonth(today), "yyyy-MM-dd"), to: format(endOfMonth(today), "yyyy-MM-dd") };
  if (filters.periodo === "mes-anterior") {
    const prev = subMonths(today, 1);
    return { from: format(startOfMonth(prev), "yyyy-MM-dd"), to: format(endOfMonth(prev), "yyyy-MM-dd") };
  }
  if (filters.periodo === "ultimos-30") {
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    return { from: format(from, "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") };
  }
  return { from: format(startOfYear(today), "yyyy-MM-dd"), to: format(endOfYear(today), "yyyy-MM-dd") };
}
