import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { type ProjectPriority } from "@/constants";
import {
  type ProjetosFilters,
  type DeadlineFilter,
  type DateField,
} from "@/pages/projetos/components/ProjetosFilterBar";
import { type SortKey, type SortDir } from "@/pages/projetos/lib/sort";

// Lente ativa da tela de projetos. As lentes de recorte (disciplinas/cronograma/
// mapa) são rotas próprias (/disciplinas, /cronograma, /mapa); dentro de /projetos
// o toggle Quadro/Lista vive em ?v=. A lente é derivada do pathname.
export type ProjetosView = "quadro" | "lista" | "disciplinas" | "cronograma" | "mapa";

function parseView(pathname: string, params: URLSearchParams, canViewMapa: boolean): ProjetosView {
  if (pathname.startsWith("/projetos/disciplinas")) return "disciplinas";
  if (pathname.startsWith("/projetos/cronograma")) return "cronograma";
  if (pathname.startsWith("/projetos/mapa")) return canViewMapa ? "mapa" : "quadro";
  return params.get("v") === "lista" ? "lista" : "quadro";
}

// ---------- URL persistence helpers ----------
export function filtersToParams(
  filters: ProjetosFilters,
  sort: { key: SortKey; dir: SortDir },
  collapsed: Set<string>,
  viewMode: "quadro" | "lista" = "quadro"
) {
  const params = new URLSearchParams();
  if (viewMode === "lista") params.set("v", "lista");
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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const initial = useMemo(() => parseFiltersFromParams(searchParams), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [filters, setFilters] = useState<ProjetosFilters>(initial.filters);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>(initial.sort);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(initial.collapsed);

  // Lente ativa: derivada do pathname (rota). Dentro de /projetos, ?v= escolhe quadro/lista.
  const activeTab = parseView(pathname, searchParams, canViewMapa);
  const viewMode: "quadro" | "lista" = activeTab === "lista" ? "lista" : "quadro";

  // Compat: links antigos com ?view=disciplinas|cronograma|mapa viram as rotas novas.
  useEffect(() => {
    const legacy = searchParams.get("view");
    if (pathname === "/projetos" && legacy) {
      const dest =
        legacy === "disciplinas" || legacy === "cronograma" || legacy === "mapa" ? `/projetos/${legacy}` : "/projetos";
      navigate(dest, { replace: true });
    }
  }, [pathname, searchParams, navigate]);

  // Toggle Quadro/Lista (só em /projetos): grava ?v=.
  const setViewMode = useCallback(
    (mode: "quadro" | "lista") => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (mode === "lista") next.set("v", "lista");
          else next.delete("v");
          return next;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );

  // Sync state → URL (só na coleção /projetos, onde os filtros e o ?v= vivem).
  // Nas rotas de recorte não reescrevemos a URL para não apagar o pathname; e se
  // ainda houver ?view= legado, deixamos o redirect acima resolver primeiro (senão
  // este sync clobbaria o navigate).
  useEffect(() => {
    if (pathname !== "/projetos" || searchParams.get("view")) return;
    const params = filtersToParams(filters, sort, collapsedColumns, viewMode);
    setSearchParams(params, { replace: true });
  }, [filters, sort, collapsedColumns, viewMode, pathname, searchParams, setSearchParams]);

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
    viewMode,
    setViewMode,
  };
}
