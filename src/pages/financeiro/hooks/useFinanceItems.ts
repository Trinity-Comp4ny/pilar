// Cache policy:
// - itemsQuery (despesas/receitas) = dado financeiro crítico → staleTime 30s
//   (mesmo de useLancamentosPaginados/resumo — filtro/busca mudam o resultado a
//   qualquer momento, não faz sentido cachear por mais tempo que isso).
// - auxQuery (categorias/contas/cartões/fornecedores) = dado auxiliar que muda
//   pouco → staleTime 10min, sem refetchInterval.
//
// Spec 044: paginação server-side via get_lancamentos_pagina (spec 033/ADR 0017,
// já suporta p_tipo) — substitui o teto fixo de 2000 linhas (ACH-FIN-07) com busca e
// ordenação sobre a base inteira, não só sobre o que coube no teto. A view
// `lancamentos` (estendida com Asaas/recorrente/periodicidade) já cobre os campos de
// DespesaItem/ReceitaItem; o mapeamento abaixo só reprojeta os nomes genéricos
// (contraparte_*) para os nomes específicos que o resto do módulo já espera
// (fornecedor_*/cliente_*), então FinanceItemForm, DespesaDetailDialog etc. não mudam.
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const PAGE_SIZE = 100;

export type FinanceItemTipo = "despesa" | "receita";
export type FinanceItemStatusFilter = "todos" | "pago" | "recebido" | "pendente" | "atrasado";

export interface DespesaItem {
  id: string;
  data_vencimento: string;
  data_pagamento?: string | null;
  descricao: string;
  categoria_id: string | null;
  categoria_nome?: string | null;
  valor: number;
  status: string;
  projeto_id: string | null;
  projeto_codigo?: string | null;
  nota_fiscal: string | null;
  conta_id: string | null;
  cartao_id: string | null;
  observacao: string | null;
  fornecedor_id: string | null;
  fornecedor_nome?: string | null;
  forma_pagamento?: string | null;
  created_by?: string;
  grupo_parcela?: string | null;
  parcela_numero?: number | null;
  parcela_total?: number | null;
  recorrente?: boolean;
  periodicidade?: string;
}

export interface ReceitaItem {
  id: string;
  data_vencimento: string;
  data_recebimento?: string | null;
  descricao: string;
  projeto_id: string | null;
  categoria_id: string | null;
  categoria_nome?: string;
  valor: number;
  forma_pagamento: string | null;
  nota_fiscal: string | null;
  status: string;
  conta_id: string | null;
  cliente_id: string | null;
  observacao: string | null;
  cliente_nome?: string;
  projeto_codigo?: string;
  grupo_parcela?: string | null;
  parcela_numero?: number | null;
  parcela_total?: number | null;
  asaas_payment_id?: string | null;
  asaas_payment_url?: string | null;
  asaas_payment_status?: string | null;
  asaas_billing_type?: string | null;
}

export interface AuxData {
  categorias: { id: string; name: string }[];
  contas: { id: string; nome: string }[];
  cartoes: { id: string; nome: string; tipo: string; dia_fechamento: number | null }[];
  projetos: { id: string; projetoID: string | null }[];
  fornecedores: { id: string; name: string }[];
  clientes: {
    id: string;
    nome: string;
    chaves_pix?: Array<{ chave: string; tipo: string }>;
  }[];
}

const QK = {
  despesas: ["finance-items", "despesa"] as const,
  receitas: ["finance-items", "receita"] as const,
  aux: (tipo: FinanceItemTipo) => ["finance-items-aux", tipo] as const,
};

// Vocabulário de status é compartilhado com Lançamentos (pagos/pendentes/atrasados),
// mas a UI de Despesas/Receitas usa rótulos por tipo (pago/recebido). "atrasado"
// mapeado pro banco corrige um bug pré-existente: o filtro client-side antigo
// comparava contra `status === "Atrasado"`, um valor que nunca existiu na coluna
// (é status calculado, não armazenado) — o filtro nunca funcionava. A RPC calcula
// atrasado de verdade (não pago E vencido).
function statusToRpcArg(status: FinanceItemStatusFilter): string | undefined {
  switch (status) {
    case "pago":
    case "recebido":
      return "pagos";
    case "pendente":
      return "pendentes";
    case "atrasado":
      return "atrasados";
    default:
      return undefined;
  }
}

type LancamentoRow = Tables<"lancamentos">;

function toDespesaItem(l: LancamentoRow): DespesaItem {
  return {
    id: l.id!,
    data_vencimento: l.data_vencimento!,
    data_pagamento: l.data_efetivacao,
    descricao: l.descricao ?? "",
    categoria_id: l.categoria_id,
    categoria_nome: l.categoria_nome,
    valor: Number(l.valor),
    status: l.status ?? "",
    projeto_id: l.projeto_id,
    projeto_codigo: l.projeto_codigo,
    nota_fiscal: l.nota_fiscal,
    conta_id: l.conta_id,
    cartao_id: l.cartao_id,
    observacao: l.observacao,
    fornecedor_id: l.contraparte_id,
    fornecedor_nome: l.contraparte_nome,
    forma_pagamento: l.forma_pagamento,
    created_by: l.created_by ?? undefined,
    grupo_parcela: l.grupo_parcela,
    parcela_numero: l.parcela_numero,
    parcela_total: l.parcela_total,
    recorrente: l.recorrente ?? false,
    periodicidade: l.periodicidade ?? undefined,
  };
}

function toReceitaItem(l: LancamentoRow): ReceitaItem {
  return {
    id: l.id!,
    data_vencimento: l.data_vencimento!,
    data_recebimento: l.data_efetivacao,
    descricao: l.descricao ?? "",
    projeto_id: l.projeto_id,
    categoria_id: l.categoria_id,
    categoria_nome: l.categoria_nome ?? undefined,
    valor: Number(l.valor),
    forma_pagamento: l.forma_pagamento,
    nota_fiscal: l.nota_fiscal,
    status: l.status ?? "",
    conta_id: l.conta_id,
    cliente_id: l.contraparte_id,
    observacao: l.observacao,
    cliente_nome: l.contraparte_nome ?? undefined,
    projeto_codigo: l.projeto_codigo ?? undefined,
    grupo_parcela: l.grupo_parcela,
    parcela_numero: l.parcela_numero,
    parcela_total: l.parcela_total,
    asaas_payment_id: l.asaas_payment_id,
    asaas_payment_url: l.asaas_payment_url,
    asaas_payment_status: l.asaas_payment_status,
    asaas_billing_type: l.asaas_billing_type,
  };
}

async function fetchAuxData(tipo: FinanceItemTipo): Promise<AuxData> {
  const tipoCategoria = tipo === "despesa" ? "Despesa" : "Receita";
  const results = await Promise.all([
    supabase.from("categorias_financeiras").select("id, nome").eq("tipo", tipoCategoria).order("nome"),
    supabase.from("contas").select("id, nome").is("deleted_at", null).order("nome"),
    tipo === "despesa"
      ? supabase.from("cartoes").select("id, nome, tipo, dia_fechamento").is("deleted_at", null)
      : Promise.resolve({ data: [] as never[], error: null }),
    supabase.from("projetos").select("id, nome, codigo_projeto").is("deleted_at", null).order("nome"),
    tipo === "despesa"
      ? supabase.from("fornecedores").select("id, nome").order("nome")
      : Promise.resolve({ data: [] as never[], error: null }),
    tipo === "receita"
      ? supabase.from("clientes").select("id, nome, chaves_pix").order("nome")
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);

  const auxError = results.find((r) => "error" in r && r.error)?.error;
  if (auxError) throw auxError;

  const [
    { data: categoriasData },
    { data: contasData },
    { data: cartoesData },
    { data: projetosData },
    { data: fornecedoresData },
    { data: clientesData },
  ] = results;

  return {
    categorias: (categoriasData ?? []).map((c) => ({ id: c.id, name: c.nome })),
    contas: contasData ?? [],
    cartoes: (cartoesData ?? []) as AuxData["cartoes"],
    projetos: (projetosData ?? []).map((p) => ({ id: p.id, projetoID: p.codigo_projeto })),
    fornecedores: (fornecedoresData ?? []).map((s) => ({ id: s.id, name: s.nome })),
    clientes: (clientesData ?? []).map((c) => ({
      id: c.id,
      nome: c.nome,
      chaves_pix: Array.isArray(c.chaves_pix) ? (c.chaves_pix as Array<{ chave: string; tipo: string }>) : [],
    })),
  };
}

export interface FinanceItemsPaginadosArgs<T extends FinanceItemTipo = FinanceItemTipo> {
  tipo: T;
  search: string;
  status: FinanceItemStatusFilter;
}

interface FinanceItemsPaginadosResult<T> {
  items: T[];
  isLoading: boolean;
  isFetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isError: boolean;
  refetch: () => void;
}

/**
 * Paginação server-side (spec 044). Reusa get_lancamentos_pagina (spec 033) fixando
 * p_tipo — filtro, busca e ordenação por vencimento rodam no banco, sem teto de
 * linhas. `queryKey` começa com o mesmo prefixo de FINANCE_ITEMS_KEYS, então
 * useFinanceItemMutations continua invalidando esta query normalmente.
 */
export function useFinanceItemsPaginados(
  args: FinanceItemsPaginadosArgs<"despesa">
): FinanceItemsPaginadosResult<DespesaItem>;
export function useFinanceItemsPaginados(
  args: FinanceItemsPaginadosArgs<"receita">
): FinanceItemsPaginadosResult<ReceitaItem>;
export function useFinanceItemsPaginados({
  tipo,
  search,
  status,
}: FinanceItemsPaginadosArgs): FinanceItemsPaginadosResult<DespesaItem | ReceitaItem> {
  const baseKey = tipo === "despesa" ? QK.despesas : QK.receitas;
  const p_status = statusToRpcArg(status);
  const p_search = search.trim() || undefined;

  const query = useInfiniteQuery({
    queryKey: [...baseKey, p_search, p_status] as const,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("get_lancamentos_pagina", {
        p_tipo: tipo,
        p_status,
        p_search,
        p_sort_key: "data",
        p_sort_dir: "desc",
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return (data ?? []) as LancamentoRow[];
    },
    getNextPageParam: (lastPage, allPages) => (lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined),
    staleTime: 30 * 1000,
  });

  const rows = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);
  const items = useMemo(
    () => (tipo === "despesa" ? rows.map(toDespesaItem) : rows.map(toReceitaItem)),
    [rows, tipo]
  );

  return {
    items,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useFinanceItemsAux(tipo: FinanceItemTipo) {
  const auxQuery = useQuery({
    queryKey: QK.aux(tipo),
    queryFn: () => fetchAuxData(tipo),
    staleTime: 10 * 60 * 1000,
  });

  const emptyAux: AuxData = {
    categorias: [],
    contas: [],
    cartoes: [],
    projetos: [],
    fornecedores: [],
    clientes: [],
  };

  return { aux: auxQuery.data ?? emptyAux, isLoading: auxQuery.isLoading, isError: auxQuery.isError };
}

export const FINANCE_ITEMS_KEYS = QK;
