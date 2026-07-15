// Filtros de coluna do relatório. Puros: recebem os dados e o conjunto de
// filtros ativos e devolvem o subconjunto ou as opções compatíveis.
import type { ReportRow } from "./useRelatorioData";

export interface ColumnFilters {
  categoria: string;
  cliente: string;
  status: string;
  projeto: string;
  conta: string;
}

export const EMPTY_FILTERS: ColumnFilters = {
  categoria: "",
  cliente: "",
  status: "",
  projeto: "",
  conta: "",
};

// Aplica todos os filtros exceto o indicado em `exclude`.
export function applyFilters(data: ReportRow[], filters: ColumnFilters, exclude?: keyof ColumnFilters): ReportRow[] {
  return data.filter((row) => {
    if (exclude !== "categoria" && filters.categoria && row.Categoria !== filters.categoria) return false;
    if (exclude !== "cliente" && filters.cliente && row["Cliente / Fornecedor"] !== filters.cliente) return false;
    if (exclude !== "status" && filters.status && row.Status !== filters.status) return false;
    if (exclude !== "projeto" && filters.projeto && row.Projeto !== filters.projeto) return false;
    if (exclude !== "conta" && filters.conta && row.Conta !== filters.conta) return false;
    return true;
  });
}

export interface FilterOptions {
  categorias: string[];
  clientes: string[];
  status: string[];
  projetos: string[];
  contas: string[];
}

// Opções inteligentes: cada select mostra apenas valores compatíveis com os
// demais filtros (o próprio campo é excluído do recorte).
export function computeFilterOptions(data: ReportRow[], filters: ColumnFilters): FilterOptions {
  const unique = (rows: ReportRow[], key: keyof ReportRow) =>
    Array.from(new Set(rows.map((r) => r[key]).filter((v) => v && v !== "-"))).sort() as string[];

  return {
    categorias: unique(applyFilters(data, filters, "categoria"), "Categoria"),
    clientes: unique(applyFilters(data, filters, "cliente"), "Cliente / Fornecedor"),
    status: unique(applyFilters(data, filters, "status"), "Status"),
    projetos: unique(applyFilters(data, filters, "projeto"), "Projeto"),
    contas: unique(applyFilters(data, filters, "conta"), "Conta"),
  };
}
