import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StatusFinanceiro = "Pendente" | "Pago" | "Recebido" | "Atrasado" | "Cancelado";

export interface PagamentoProjeto {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string | null;
  data_recebimento: string | null;
  status: StatusFinanceiro;
  cliente_id: string | null;
  cliente_nome: string | null;
  nota_fiscal: string | null;
  forma_pagamento: string | null;
  parcela_numero: number | null;
  parcela_total: number | null;
  grupo_parcela: string | null;
  observacao: string | null;
  created_at: string;
}

export interface ResumoPagamentos {
  totalContrato: number;
  totalFaturado: number;
  totalRecebido: number;
  totalPendente: number;
  totalAtrasado: number;
  percentualRecebido: number;
  proximoVencimento: string | null;
  qtdPendentes: number;
  qtdAtrasados: number;
}

const hoje = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const calcDiasAtraso = (dataVencimento: string | null): number => {
  if (!dataVencimento) return 0;
  const venc = new Date(dataVencimento + "T00:00:00");
  const diff = hoje().getTime() - venc.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export const getDiasStatus = (pagamento: PagamentoProjeto) => {
  if (pagamento.status === "Recebido" || pagamento.status === "Pago" || pagamento.status === "Cancelado") {
    return { dias: 0, tipo: pagamento.status as string };
  }

  const dias = calcDiasAtraso(pagamento.data_vencimento);

  if (dias > 0) return { dias, tipo: "atrasado" };
  if (dias >= -7) return { dias: Math.abs(dias), tipo: "proximo" };
  return { dias: Math.abs(dias), tipo: "no_prazo" };
};

export const usePagamentosProjeto = (projetoId: string | undefined) => {
  return useQuery({
    queryKey: ["pagamentos-projeto", projetoId],
    queryFn: async () => {
      if (!projetoId) return { pagamentos: [], resumo: null };

      const { data, error } = await supabase
        .from("receitas")
        .select(
          "id, descricao, valor, data_vencimento, data_recebimento, status, cliente_id, nota_fiscal, forma_pagamento, parcela_numero, parcela_total, grupo_parcela, observacao, created_at, clientes(nome)"
        )
        .eq("projeto_id", projetoId)
        .is("deleted_at", null)
        .order("data_vencimento", { ascending: true });

      if (error) throw error;

      const pagamentos: PagamentoProjeto[] = (data || []).map((r) => ({
        id: r.id,
        descricao: r.descricao,
        valor: r.valor,
        data_vencimento: r.data_vencimento,
        data_recebimento: r.data_recebimento,
        status: r.status as StatusFinanceiro,
        cliente_id: r.cliente_id,
        cliente_nome: (r as unknown as { clientes?: { nome?: string } }).clientes?.nome ?? null,
        nota_fiscal: r.nota_fiscal,
        forma_pagamento: r.forma_pagamento,
        parcela_numero: r.parcela_numero,
        parcela_total: r.parcela_total,
        grupo_parcela: r.grupo_parcela,
        observacao: r.observacao,
        created_at: r.created_at ?? "",
      }));

      // Buscar valor_contrato do projeto
      const { data: proj } = await supabase.from("projetos").select("valor_contrato").eq("id", projetoId).single();

      const totalContrato = proj?.valor_contrato ?? 0;

      const ativos = pagamentos.filter((p) => p.status !== "Cancelado");
      const totalFaturado = ativos.reduce((s, p) => s + p.valor, 0);
      const recebidos = ativos.filter((p) => p.status === "Recebido" || p.status === "Pago");
      const totalRecebido = recebidos.reduce((s, p) => s + p.valor, 0);
      const pendentes = ativos.filter((p) => p.status === "Pendente" || p.status === "Atrasado");
      const totalPendente = pendentes.reduce((s, p) => s + p.valor, 0);

      const atrasados = pendentes.filter((p) => calcDiasAtraso(p.data_vencimento) > 0);
      const totalAtrasado = atrasados.reduce((s, p) => s + p.valor, 0);

      const proximosPendentes = pendentes
        .filter((p) => calcDiasAtraso(p.data_vencimento) <= 0)
        .sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""));

      const resumo: ResumoPagamentos = {
        totalContrato,
        totalFaturado,
        totalRecebido,
        totalPendente,
        totalAtrasado,
        percentualRecebido: totalContrato > 0 ? Math.round((totalRecebido / totalContrato) * 100) : 0,
        proximoVencimento: proximosPendentes[0]?.data_vencimento ?? null,
        qtdPendentes: pendentes.length,
        qtdAtrasados: atrasados.length,
      };

      return { pagamentos, resumo };
    },
    enabled: !!projetoId,
    staleTime: 1000 * 60 * 2,
  });
};

export const useMarcarRecebido = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ receitaId, dataRecebimento }: { receitaId: string; dataRecebimento?: string }) => {
      const { error } = await supabase
        .from("receitas")
        .update({
          status: "Recebido" as StatusFinanceiro,
          data_recebimento: dataRecebimento || new Date().toISOString().split("T")[0],
        })
        .eq("id", receitaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-projeto"] });
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
    },
  });
};

export const useMarcarAtrasado = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (receitaId: string) => {
      const { error } = await supabase
        .from("receitas")
        .update({ status: "Atrasado" as StatusFinanceiro })
        .eq("id", receitaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos-projeto"] });
      queryClient.invalidateQueries({ queryKey: ["receitas"] });
    },
  });
};
