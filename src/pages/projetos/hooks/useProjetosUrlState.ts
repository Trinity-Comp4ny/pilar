import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { type ProjectPriority } from "@/constants";
import {
  type ProjetosFilters,
  type DeadlineFilter,
  type DateField,
} from "@/pages/projetos/components/ProjetosFilterBar";
import { type SortKey, type SortDir } from "@/pages/projetos/lib/sort";

// Visualização ativa da tela de projetos. Vive na URL (?view=) para dar deep-link
// e permitir que a sidebar do módulo aponte direto para cada lente.
export type ProjetosView = "kanban" | "disciplinas" | "cronograma" | "mapa";

function parseView(params: URLSearchParams, canViewMapa: boolean): ProjetosView {
  const view = params.get("view");
  if (view === "mapa") return canViewMapa ? "mapa" : "kanban";
  if (view === "disciplinas" || view === "cronograma") return view;
  return "kanban";
}

// ---------- URL persistence helpers ----------
export function filtersToParams(
  filters: ProjetosFilters,
  sort: { key: SortKey; dir: SortDir },
  collapsed: Set<string>,
  view: ProjetosView = "kanban"
) {
  const params = new URLSearchParams();
  if (view !== "kanban") params.set("view", view);
  if (filters.search) params.set("q", filters.search);
  if (filters.prioridades.length) params.set("prio", filters.prioridades.join(","));
  if (filters.pessoaIds.length) params.set("p", filters.pessoaIds.join(","));
  if (filters.clienteIds.length) params.set("c", filters.clienteIds.join(","));
  if (filters.disciplinaIds.length) params.set("disc", filters.disciplinaIds.join(","));
  if (filters.deadlineStatus.length) params.set("d", filters.deadlineStatus.join(","));
  if (filters.dataCampo !== "previsao") params.set("dc", filters.dataCampo);
  if (filters.dataInicio) params.set("di", filters.dataInicio);
  if (filters.dataFim) params.set("df", filters.dataFim);
  if (sort.key !== "priority" || sort.dir !== "asc") params.set("sort", `${sort.key}.${sort.dir}`);
  if (collapsed.size > 0) params.set("col", [...collapsed].join(","));
  return params;
}

export function parseFiltersFromParams(params: URLSearchParams): {
  filters: ProjetosFilters;
  sort: { key: SortKey; dir: SortDir };
  collapsed: Set<string>;
} {
  const sortRaw = params.get("sort");
  const [sk, sd] = (sortRaw || "priority.asc").split(".");
  return {
    filters: {
      search: params.get("q") || "",
      prioridades: (params.get("prio")?.split(",").filter(Boolean) as ProjectPriority[]) || [],
      pessoaIds: params.get("p")?.split(",").filter(Boolean) || [],
      clienteIds: params.get("c")?.split(",").filter(Boolean) || [],
      disciplinaIds: params.get("disc")?.split(",").filter(Boolean) || [],
      deadlineStatus: (params.get("d")?.split(",").filter(Boolean) as DeadlineFilter[]) || [],
      dataCampo: (["previsao", "inicio", "final"] as DateField[]).includes(params.get("dc") as DateField)
        ? (params.get("dc") as DateField)
        : "previsao",
      dataInicio: params.get("di") || "",
      dataFim: params.get("df") || "",
    },
    sort: {
      key: (["priority", "dueDate", "value", "name", "created"] as SortKey[]).includes(sk as SortKey)
        ? (sk as SortKey)
        : "priority",
      dir: sd === "desc" ? "desc" : "asc",
    },
    collapsed: new Set(params.get("col")?.split(",").filter(Boolean) || []),
  };
}

// Estado de filtros, ordenação e colunas minimizadas do quadro, persistido na URL.
// Lê o estado inicial dos search params uma vez e sincroniza de volta (replace)
// a cada mudança, preservando o comportamento original da página.
export function useProjetosUrlState(canViewMapa: boolean) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = useMemo(() => parseFiltersFromParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [filters, setFilters] = useState<ProjetosFilters>(initial.filters);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>(initial.sort);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(initial.collapsed);

  // Aba ativa: derivada da URL (fonte de verdade), escrita de volta abaixo.
  const activeTab = parseView(searchParams, canViewMapa);
  const setActiveTab = useCallback(
    (tab: ProjetosView) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === "kanban") next.delete("view");
          else next.set("view", tab);
          return next;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );

  // Sync state → URL (preserva a aba ativa junto dos filtros)
  useEffect(() => {
    const params = filtersToParams(filters, sort, collapsedColumns, activeTab);
    setSearchParams(params, { replace: true });
  }, [filters, sort, collapsedColumns, activeTab, setSearchParams]);

  const toggleColumn = (status: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  return {
    filters,
    setFilters,
    sort,
    setSort,
    collapsedColumns,
    setCollapsedColumns,
    toggleColumn,
    activeTab,
    setActiveTab,
  };
}
