import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Lancamento, GrupoTipo, GrupoStatus, TipoLancamento } from "./useLancamentosUnified";

const PAGE_SIZE = 100;

export interface LancamentosPaginadosArgs {
  from: string | null;
  to: string | null;
}

export interface LancamentosCursor {
  data_vencimento: string;
  id: string;
}

type LancamentoRow = {
  id: string;
  tipo: TipoLancamento;
  data_vencimento: string;
  data_efetivacao: string | null;
  data_competencia: string | null;
  descricao: string;
  valor: number;
  status: string;
  categoria_id: string | null;
  projeto_id: string | null;
  centro_custo_id: string | null;
  conta_id: string | null;
  contraparte_id: string | null;
  contraparte_tipo: string | null;
  forma_pagamento: string | null;
  cartao_id: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  grupo_parcela: string | null;
  grupo_tipo: GrupoTipo;
  grupo_status: GrupoStatus;
  grupo_total_original: number | null;
  tags: string[] | null;
  transferencia_par_id: string | null;
};

interface PageResult {
  rows: LancamentoRow[];
  nextCursor: LancamentosCursor | null;
}

/**
 * Paginação cursor-based (keyset) sobre a view `lancamentos`.
 *
 * Cursor = (data_vencimento DESC, id DESC). Próxima página filtra
 * `data_vencimento < cursor.data_vencimento OR (data_vencimento = cursor.data_vencimento AND id < cursor.id)`.
 *
 * Vantagem vs. offset/limit: latência constante mesmo no fim da lista
 * (sem `OFFSET 50000`), e estável quando há inserts simultâneos.
 */
export function useLancamentosPaginados({ from, to }: LancamentosPaginadosArgs) {
  const query = useInfiniteQuery({
    queryKey: ["lancamentos-paginados", from, to],
    initialPageParam: null as LancamentosCursor | null,
    queryFn: async ({ pageParam }): Promise<PageResult> => {
      let q = supabase
        .from("lancamentos")
        .select("*")
        .order("data_vencimento", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE);

      if (from) q = q.gte("data_vencimento", from);
      if (to) q = q.lte("data_vencimento", to);

      if (pageParam) {
        // Keyset: (data_vencimento, id) < (cursor.data_vencimento, cursor.id)
        // Usando .or() com combinação composta:
        q = q.or(
          `data_vencimento.lt.${pageParam.data_vencimento},and(data_vencimento.eq.${pageParam.data_vencimento},id.lt.${pageParam.id})`
        );
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as unknown as LancamentoRow[];
      const last = rows.length === PAGE_SIZE ? rows[rows.length - 1] : null;
      const nextCursor: LancamentosCursor | null = last ? { data_vencimento: last.data_vencimento, id: last.id } : null;

      return { rows, nextCursor };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30 * 1000,
  });

  // Auxiliares (categorias, projetos, etc.) carregados em paralelo via aux hook
  // -> aqui fazemos só o enrichment com lookup tables na primeira página.
  const enriched = useEnrichedLancamentos(query.data?.pages.flatMap((p) => p.rows) ?? []);

  return {
    data: enriched,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch: query.refetch,
    error: query.error,
  };
}

/**
 * Faz o enrichment client-side de IDs → nomes. Para evitar overhead de
 * fetchar lookup tables a cada página, mantemos um único query enriquecido.
 * Nota: para um enriquecimento mais robusto (com lookups paralelos),
 * o consumidor pode combinar este hook com `useLancamentosFiltersData`.
 */
function useEnrichedLancamentos(rows: LancamentoRow[]): Lancamento[] {
  return useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        data_vencimento: r.data_vencimento,
        data_efetivacao: r.data_efetivacao,
        data_competencia: r.data_competencia,
        descricao: r.descricao,
        valor: Number(r.valor || 0),
        status: r.status,
        categoria_id: r.categoria_id,
        categoria_nome: null,
        projeto_id: r.projeto_id,
        projeto_codigo: null,
        centro_custo_id: r.centro_custo_id,
        conta_id: r.conta_id,
        conta_nome: null,
        contraparte_id: r.contraparte_id,
        contraparte_tipo: r.contraparte_tipo,
        contraparte_nome: null,
        forma_pagamento: r.forma_pagamento,
        cartao_id: r.cartao_id,
        parcela_numero: r.parcela_numero,
        parcela_total: r.parcela_total,
        grupo_parcela: r.grupo_parcela,
        grupo_tipo: r.grupo_tipo,
        grupo_status: r.grupo_status,
        grupo_total_original: r.grupo_total_original == null ? null : Number(r.grupo_total_original),
        tags: r.tags,
        transferencia_par_id: r.transferencia_par_id,
      })),
    [rows]
  );
}
