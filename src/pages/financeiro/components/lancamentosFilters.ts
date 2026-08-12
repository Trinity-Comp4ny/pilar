import { addDays, format, parseISO } from "date-fns";
import { detectPreset, rangeForPreset, type PeriodoPreset } from "@/lib/periodo";
import { parseCurrencyString } from "@/lib/currencyUtils";

export type Periodo = "mes-atual" | "mes-anterior" | "ultimos-30" | "ano" | "tudo";

// Lançamentos usa "ano"; a fonte única (spec 024) usa "este-ano". Só isso diverge.
function toPresetKey(p: Periodo): PeriodoPreset {
  return p === "ano" ? "este-ano" : p;
}
function fromPresetKey(p: PeriodoPreset): Periodo {
  return p === "este-ano" ? "ano" : (p as Periodo);
}
export type TipoFilter = "todos" | "receita" | "despesa";
export type StatusFilter = "todos" | "pagos" | "pendentes" | "atrasados";
/** Atalhos de intenção da barra. "atrasados"/"vence-semana" furam o período. */
export type QuickFilter = "em-aberto" | "atrasados" | "vence-semana" | "pagos";

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

// Chaves de URL dos filtros de Lançamentos. Prefixo "f" para não colidir com os
// params do Financeiro (tab, from, to, viz).
const FILTER_PARAM_KEYS = [
  "fq",
  "ft",
  "fs",
  "fp",
  "fcf",
  "fct",
  "fcat",
  "fproj",
  "fcli",
  "fforn",
  "fforma",
  "fmin",
  "fmax",
] as const;

const PERIODOS: Periodo[] = ["mes-atual", "mes-anterior", "ultimos-30", "ano", "tudo"];
const TIPOS: TipoFilter[] = ["todos", "receita", "despesa"];
const STATUSES: StatusFilter[] = ["todos", "pagos", "pendentes", "atrasados"];

/** Remove das searchParams todas as chaves de filtro de Lançamentos. */
export function clearFilterParams(params: URLSearchParams): void {
  FILTER_PARAM_KEYS.forEach((k) => params.delete(k));
}

/** Grava os filtros nas searchParams (só o que difere do padrão). */
export function writeFiltersToParams(params: URLSearchParams, f: LancamentosFilters): void {
  clearFilterParams(params);
  if (f.search) params.set("fq", f.search);
  if (f.tipo !== "todos") params.set("ft", f.tipo);
  if (f.status !== "todos") params.set("fs", f.status);
  if (f.periodo !== defaultFilters.periodo) params.set("fp", f.periodo);
  if (f.customFrom) params.set("fcf", f.customFrom);
  if (f.customTo) params.set("fct", f.customTo);
  if (f.categorias.length) params.set("fcat", f.categorias.join(","));
  if (f.projetos.length) params.set("fproj", f.projetos.join(","));
  if (f.clientes.length) params.set("fcli", f.clientes.join(","));
  if (f.fornecedores.length) params.set("fforn", f.fornecedores.join(","));
  if (f.formasPagamento.length) params.set("fforma", f.formasPagamento.join(","));
  if (f.valorMin) params.set("fmin", f.valorMin);
  if (f.valorMax) params.set("fmax", f.valorMax);
}

/** Reconstrói os filtros a partir das searchParams. */
export function readFiltersFromParams(params: URLSearchParams): LancamentosFilters {
  const arr = (k: string) => {
    const v = params.get(k);
    return v ? v.split(",").filter(Boolean) : [];
  };
  const periodoRaw = params.get("fp");
  const periodo: Periodo | "custom" =
    periodoRaw === "custom" || (periodoRaw && PERIODOS.includes(periodoRaw as Periodo))
      ? (periodoRaw as Periodo | "custom")
      : defaultFilters.periodo;
  const tipoRaw = params.get("ft") as TipoFilter | null;
  const statusRaw = params.get("fs") as StatusFilter | null;

  return {
    search: params.get("fq") ?? "",
    tipo: tipoRaw && TIPOS.includes(tipoRaw) ? tipoRaw : "todos",
    status: statusRaw && STATUSES.includes(statusRaw) ? statusRaw : "todos",
    periodo,
    customFrom: params.get("fcf"),
    customTo: params.get("fct"),
    categorias: arr("fcat"),
    projetos: arr("fproj"),
    clientes: arr("fcli"),
    fornecedores: arr("fforn"),
    formasPagamento: arr("fforma"),
    valorMin: params.get("fmin") ?? "",
    valorMax: params.get("fmax") ?? "",
  };
}

export function periodoRange(filters: LancamentosFilters): { from: string | null; to: string | null } {
  if (filters.periodo === "custom") {
    return { from: filters.customFrom, to: filters.customTo };
  }
  if (filters.periodo === "tudo") return { from: null, to: null };
  const r = rangeForPreset(toPresetKey(filters.periodo));
  return {
    from: r.from ? format(r.from, "yyyy-MM-dd") : null,
    to: r.to ? format(r.to, "yyyy-MM-dd") : null,
  };
}

/** Intervalo atual dos filtros como Dates, para alimentar o FiltroPeriodo. */
export function filtersToDates(filters: LancamentosFilters): { from: Date | undefined; to: Date | undefined } {
  if (filters.periodo === "custom") {
    return {
      from: filters.customFrom ? parseISO(filters.customFrom) : undefined,
      to: filters.customTo ? parseISO(filters.customTo) : undefined,
    };
  }
  if (filters.periodo === "tudo") return { from: undefined, to: undefined };
  return rangeForPreset(toPresetKey(filters.periodo));
}

/**
 * Converte os filtros do front nos argumentos das RPCs server-side
 * (get_lancamentos_pagina / get_lancamentos_resumo). Fonte única do mapeamento
 * para página e resumo não divergirem. `undefined` = sem restrição no banco.
 */
export function filtersToRpcArgs(f: LancamentosFilters) {
  const range = periodoRange(f);
  const min = f.valorMin ? parseCurrencyString(f.valorMin) : null;
  const max = f.valorMax ? parseCurrencyString(f.valorMax) : null;
  return {
    p_from: range.from ?? undefined,
    p_to: range.to ?? undefined,
    p_tipo: f.tipo === "todos" ? undefined : f.tipo,
    p_status: f.status === "todos" ? undefined : f.status,
    p_categorias: f.categorias.length ? f.categorias : undefined,
    p_projetos: f.projetos.length ? f.projetos : undefined,
    p_clientes: f.clientes.length ? f.clientes : undefined,
    p_fornecedores: f.fornecedores.length ? f.fornecedores : undefined,
    p_formas: f.formasPagamento.length ? f.formasPagamento : undefined,
    p_valor_min: min ?? undefined,
    p_valor_max: max ?? undefined,
    p_search: f.search.trim() || undefined,
  };
}

/** Atalhos de intenção: aplicam status + período de uma vez. */
export const QUICK_LABEL: Record<QuickFilter, string> = {
  "em-aberto": "Em aberto",
  atrasados: "Atrasados",
  "vence-semana": "Vence esta semana",
  pagos: "Pagos",
};

export function applyQuick(quick: QuickFilter): Partial<LancamentosFilters> {
  switch (quick) {
    case "em-aberto":
      return { status: "pendentes", periodo: "tudo", customFrom: null, customTo: null };
    case "atrasados":
      // Atrasado = venceu no passado. "Mês atual" esconderia, então fura o período.
      return { status: "atrasados", periodo: "tudo", customFrom: null, customTo: null };
    case "vence-semana": {
      const hoje = new Date();
      const fim = addDays(hoje, 7);
      return {
        status: "pendentes",
        periodo: "custom",
        customFrom: format(hoje, "yyyy-MM-dd"),
        customTo: format(fim, "yyyy-MM-dd"),
      };
    }
    case "pagos":
      return { status: "pagos", periodo: "tudo", customFrom: null, customTo: null };
  }
}

/** Deriva qual quick está ativo, para o destaque do botão (best-effort). */
export function matchQuick(f: LancamentosFilters): QuickFilter | null {
  if (f.status === "atrasados" && f.periodo === "tudo") return "atrasados";
  if (f.status === "pagos" && f.periodo === "tudo") return "pagos";
  if (f.status === "pendentes" && f.periodo === "custom") {
    const hoje = format(new Date(), "yyyy-MM-dd");
    if (f.customFrom === hoje) return "vence-semana";
  }
  if (f.status === "pendentes" && f.periodo === "tudo") return "em-aberto";
  return null;
}

/** Traduz uma escolha de datas do FiltroPeriodo de volta pro modelo de Lançamentos. */
export function datesToFilterPatch(from: Date | undefined, to: Date | undefined): Partial<LancamentosFilters> {
  const key = detectPreset(from, to);
  if (key === "custom") {
    return {
      periodo: "custom",
      customFrom: from ? format(from, "yyyy-MM-dd") : null,
      customTo: to ? format(to, "yyyy-MM-dd") : null,
    };
  }
  if (key === "tudo") return { periodo: "tudo", customFrom: null, customTo: null };
  return { periodo: fromPresetKey(key), customFrom: null, customTo: null };
}
