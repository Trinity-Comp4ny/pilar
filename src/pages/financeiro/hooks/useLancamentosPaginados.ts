import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lancamento } from "./useLancamentosUnified";
import { filtersToRpcArgs, type LancamentosFilters } from "../components/lancamentosFilters";

const PAGE_SIZE = 100;

export interface LancamentosPaginadosArgs {
  filters: LancamentosFilters;
  sortKey: string;
  sortDir: "asc" | "desc";
}

// Linha crua devolvida por get_lancamentos_pagina (SETOF da view lancamentos).
type LancamentoRow = Record<string, unknown> & {
  id: string;
  valor: number | string | null;
  grupo_total_original: number | string | null;
};

/**
 * Paginação server-side (spec 033 / ADR 0017). Filtro, ordenação e recorte por
 * período rodam no banco via RPC `get_lancamentos_pagina`, que compartilha a mesma
 * cláusula WHERE do resumo — a lista e os totais não podem divergir. Paginação por
 * offset; a RLS da view (security_invoker) garante o isolamento por empresa.
 */
export function useLancamentosPaginados({ filters, sortKey, sortDir }: LancamentosPaginadosArgs) {
  const rpcArgs = useMemo(() => filtersToRpcArgs(filters), [filters]);

  const query = useInfiniteQuery({
    queryKey: ["lancamentos-pagina", rpcArgs, sortKey, sortDir],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<LancamentoRow[]> => {
      const { data, error } = await supabase.rpc("get_lancamentos_pagina", {
        ...rpcArgs,
        p_sort_key: sortKey,
        p_sort_dir: sortDir,
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return (data ?? []) as unknown as LancamentoRow[];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    staleTime: 30 * 1000,
  });

  const rows = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);
  const data = useMemo<Lancamento[]>(
    () =>
      rows.map((r) => ({
        ...(r as unknown as Lancamento),
        valor: Number(r.valor ?? 0),
        grupo_total_original: r.grupo_total_original == null ? null : Number(r.grupo_total_original),
      })),
    [rows]
  );

  return {
    data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    dataUpdatedAt: query.dataUpdatedAt,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    error: query.error,
  };
}
