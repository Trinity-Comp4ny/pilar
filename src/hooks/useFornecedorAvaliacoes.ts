import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type NotasAvaliacao } from "@/lib/cotacaoConvite";

export interface AvaliacaoFornecedor {
  id: string;
  proposta_id: string;
  cotacao_id: string;
  nota_demora: number | null;
  nota_preco: number | null;
  nota_prazo: number | null;
  nota_qualidade: number | null;
  nota_geral: number | null;
  comentario: string | null;
  avaliado_em: string;
  cotacao: { descricao: string; obra: { nome: string } | null } | null;
}

const avaliacoesKey = (fornecedorId: string) => ["fornecedor-avaliacoes", fornecedorId] as const;

/** Avaliações do fornecedor (SPEC 144), com a cotação e a obra de cada uma. O fornecedor nunca vê isto. */
export function useFornecedorAvaliacoes(fornecedorId: string | undefined) {
  return useQuery({
    queryKey: avaliacoesKey(fornecedorId ?? ""),
    enabled: !!fornecedorId,
    staleTime: 1000 * 60 * 2,
    queryFn: async (): Promise<AvaliacaoFornecedor[]> => {
      const { data, error } = await supabase
        .from("fornecedor_avaliacao")
        .select(
          "id, proposta_id, cotacao_id, nota_demora, nota_preco, nota_prazo, nota_qualidade, nota_geral, comentario, avaliado_em, cotacao:obra_cotacao!cotacao_id(descricao, obra:obras(nome))"
        )
        .eq("fornecedor_id", fornecedorId!)
        .order("avaliado_em", { ascending: false })
        .returns<AvaliacaoFornecedor[]>();
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Avaliação já feita para uma proposta (para editar em vez de começar do zero). */
export function useAvaliacaoDaProposta(propostaId: string | undefined) {
  return useQuery({
    queryKey: ["fornecedor-avaliacao-proposta", propostaId],
    enabled: !!propostaId,
    queryFn: async (): Promise<AvaliacaoFornecedor | null> => {
      const { data, error } = await supabase
        .from("fornecedor_avaliacao")
        .select(
          "id, proposta_id, cotacao_id, nota_demora, nota_preco, nota_prazo, nota_qualidade, nota_geral, comentario, avaliado_em"
        )
        .eq("proposta_id", propostaId!)
        .maybeSingle();
      if (error) throw error;
      return data ? ({ ...data, cotacao: null } as AvaliacaoFornecedor) : null;
    },
  });
}

export function useAvaliarFornecedor(propostaId: string, fornecedorId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { notas: NotasAvaliacao; comentario: string }) => {
      const { data, error } = await supabase.rpc("rpc_avaliar_fornecedor", {
        p_proposta_id: propostaId,
        p_demora: v.notas.demora ?? undefined,
        p_preco: v.notas.preco ?? undefined,
        p_prazo: v.notas.prazo ?? undefined,
        p_qualidade: v.notas.qualidade ?? undefined,
        p_comentario: v.comentario.trim() || undefined,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fornecedor-avaliacao-proposta", propostaId] });
      if (fornecedorId) qc.invalidateQueries({ queryKey: avaliacoesKey(fornecedorId) });
    },
  });
}
