// Cache policy:
// - itemsQuery (despesas/receitas) = dado financeiro crítico → staleTime 2min,
//   refetchInterval 5min, refetchOnWindowFocus.
// - auxQuery (categorias/contas/cartões/fornecedores) = dado auxiliar que muda
//   pouco → staleTime 10min, sem refetchInterval.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { monitoring } from "@/lib/monitoring";

// Teto de segurança contra full-scan (ACH-FIN-07). A tela filtra/ordena no
// client, então paginação server-side quebraria a busca; o teto evita puxar a
// base inteira e avisa (via monitoring) quando for hora de paginar de verdade.
const FINANCE_ITEMS_LIMIT = 2000;

export type FinanceItemTipo = "despesa" | "receita";

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
  parcelas?: string;
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

async function fetchDespesas(): Promise<DespesaItem[]> {
  const { data, error } = await supabase
    .from("despesas")
    .select(`*, projetos (codigo_projeto), fornecedores (nome)`)
    .eq("is_fatura_payment", false)
    .is("deleted_at", null)
    .order("data_pagamento", { ascending: false })
    .order("data_vencimento", { ascending: false })
    .limit(FINANCE_ITEMS_LIMIT);

  if (error) throw error;

  if ((data?.length ?? 0) >= FINANCE_ITEMS_LIMIT) {
    monitoring.captureMessage("Despesas atingiram o teto de listagem; considerar paginação server-side", "warning");
  }

  return (
    (data ?? []) as unknown as Array<
      DespesaItem & { projetos?: { codigo_projeto?: string }; fornecedores?: { nome?: string } }
    >
  ).map((d) => ({
    ...d,
    data_pagamento: d.data_pagamento || d.data_vencimento,
    projeto_codigo: d.projetos?.codigo_projeto ?? null,
    fornecedor_nome: d.fornecedores?.nome ?? null,
  }));
}

async function fetchReceitas(): Promise<ReceitaItem[]> {
  const { data, error } = await supabase
    .from("receitas")
    .select(`*, categorias_financeiras (nome), clientes (nome), projetos (codigo_projeto)`)
    .is("deleted_at", null)
    .order("data_recebimento", { ascending: false })
    .order("data_vencimento", { ascending: false })
    .limit(FINANCE_ITEMS_LIMIT);

  if (error) throw error;

  if ((data?.length ?? 0) >= FINANCE_ITEMS_LIMIT) {
    monitoring.captureMessage("Receitas atingiram o teto de listagem; considerar paginação server-side", "warning");
  }

  return (
    (data ?? []) as unknown as Array<
      ReceitaItem & {
        categorias_financeiras?: { nome?: string };
        clientes?: { nome?: string };
        projetos?: { codigo_projeto?: string };
      }
    >
  ).map((d) => ({
    ...d,
    categoria_nome: d.categorias_financeiras?.nome,
    cliente_nome: d.clientes?.nome,
    projeto_codigo: d.projetos?.codigo_projeto,
    data_recebimento: d.data_recebimento || d.data_vencimento,
  }));
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

export function useFinanceItems(tipo: "despesa"): {
  items: DespesaItem[];
  aux: AuxData;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
};
export function useFinanceItems(tipo: "receita"): {
  items: ReceitaItem[];
  aux: AuxData;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
};
export function useFinanceItems(tipo: FinanceItemTipo): {
  items: DespesaItem[] | ReceitaItem[];
  aux: AuxData;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
} {
  const itemsQuery = useQuery<DespesaItem[] | ReceitaItem[]>({
    queryKey: tipo === "despesa" ? QK.despesas : QK.receitas,
    queryFn: () => (tipo === "despesa" ? fetchDespesas() : fetchReceitas()),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
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

  return {
    items: (itemsQuery.data ?? []) as DespesaItem[] | ReceitaItem[],
    aux: auxQuery.data ?? emptyAux,
    isLoading: itemsQuery.isLoading || auxQuery.isLoading,
    isError: itemsQuery.isError || auxQuery.isError,
    refetch: async () => {
      await Promise.all([itemsQuery.refetch(), auxQuery.refetch()]);
    },
  };
}

export const FINANCE_ITEMS_KEYS = QK;
