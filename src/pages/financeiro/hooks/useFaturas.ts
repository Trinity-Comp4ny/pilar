import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Cartao {
  id: string;
  nome: string;
  dia_fechamento: number;
  dia_vencimento: number;
  cor: string | null;
  limite: number;
  usado: number;
  disponivel: number;
  conta_pagamento_id: string | null;
}

export interface Fatura {
  id: string;
  cartao_id: string;
  cartao_nome: string;
  cartao_cor: string | null;
  mes_referencia: number;
  ano_referencia: number;
  data_inicio: string;
  data_fim: string;
  data_vencimento: string;
  status: string;
  data_pagamento: string | null;
  conta_pagamento_id: string | null;
  conta_pagamento_nome: string | null;
  valor_total: number;
  valor_pago: number;
  qtd_despesas: number;
}

export interface DespesaFatura {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  categoria_id: string | null;
  categorias_financeiras: { nome: string } | null;
}

export interface Conta {
  id: string;
  nome: string;
}

const STALE_30S = 30 * 1000;
const STALE_5MIN = 5 * 60 * 1000;

export function useCartoesResumo() {
  return useQuery({
    queryKey: ["cartoes-resumo"],
    queryFn: async () => {
      const { data, error } = await supabase.from("view_cartao_resumo").select("*");
      if (error) throw error;
      return (data ?? []) as Cartao[];
    },
    staleTime: STALE_30S,
  });
}

export function useContas() {
  return useQuery({
    queryKey: ["contas-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contas").select("id, nome").is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as Conta[];
    },
    staleTime: STALE_5MIN,
  });
}

export async function gerarFaturasCartao(cartaoId: string) {
  const now = new Date();
  const calls = [];
  for (let i = -2; i <= 1; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    calls.push(
      supabase.rpc("gerar_fatura", {
        p_cartao_id: cartaoId,
        p_mes: d.getMonth() + 1,
        p_ano: d.getFullYear(),
      })
    );
  }
  const results = await Promise.allSettled(calls);
  const realErrors = results.flatMap((r) => {
    if (r.status === "rejected") return [r.reason as Error];
    // 23505 = unique_violation: fatura já existe, esperado
    if (r.value.error && r.value.error.code !== "23505") return [new Error(r.value.error.message)];
    return [];
  });
  if (realErrors.length > 0) throw realErrors[0];
}

export function useFaturas(cartaoId: string | null) {
  return useQuery({
    queryKey: ["faturas", cartaoId],
    enabled: !!cartaoId,
    staleTime: STALE_30S,
    queryFn: async () => {
      if (!cartaoId) return [] as Fatura[];

      const { data, error } = await supabase
        .from("view_fatura_resumo")
        .select("*")
        .eq("cartao_id", cartaoId)
        .order("ano_referencia", { ascending: false })
        .order("mes_referencia", { ascending: false });

      if (error) throw error;

      const today = new Date();
      const rows = (data ?? []) as unknown as Fatura[];
      return rows
        .filter((f) => (f.valor_total ?? 0) > 0 || f.status !== "Aberta")
        .map((f) => {
          let status = f.status;
          if (status === "Aberta" && new Date(f.data_fim + "T00:00:00") < today) status = "Fechada";
          return { ...f, status };
        });
    },
  });
}

export function useDespesasFatura(faturaId: string | null) {
  return useQuery({
    queryKey: ["despesas-fatura", faturaId],
    enabled: !!faturaId,
    staleTime: STALE_30S,
    queryFn: async () => {
      if (!faturaId) return [] as DespesaFatura[];
      const { data, error } = await supabase
        .from("despesas")
        .select("id, descricao, valor, data_vencimento, status, categoria_id, categorias_financeiras(nome)")
        .eq("fatura_id", faturaId)
        .not("cartao_id", "is", null)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DespesaFatura[];
    },
  });
}

export function useInvalidateFaturas() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["faturas"] });
    qc.invalidateQueries({ queryKey: ["cartoes-resumo"] });
    qc.invalidateQueries({ queryKey: ["despesas-fatura"] });
  };
}
