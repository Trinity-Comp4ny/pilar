import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface PagarFaturaInput {
  faturaId: string;
  contaId: string;
  valor: number;
  dataPagamento?: Date;
}

/**
 * Mutation idempotente de pagar fatura.
 *
 * Cada execução gera uma idempotency_key (UUID) e mantém a mesma chave
 * enquanto a request estiver em voo. Se o usuário disparar dois cliques
 * rapidamente ou houver retry de rede, o backend reconhece a chave e
 * retorna sem duplicar o lançamento.
 *
 * A chave só é descartada após sucesso confirmado — em caso de erro,
 * o próximo retry reutiliza a mesma chave.
 */
export function usePagarFatura() {
  const queryClient = useQueryClient();
  const inflightKeyRef = useRef<string | null>(null);

  return useMutation({
    mutationFn: async ({ faturaId, contaId, valor, dataPagamento }: PagarFaturaInput) => {
      if (!inflightKeyRef.current) {
        inflightKeyRef.current = crypto.randomUUID();
      }

      const { error } = await supabase.rpc("pagar_fatura", {
        p_fatura_id: faturaId,
        p_conta_id: contaId,
        p_valor_pago: valor,
        p_data_pagamento: format(dataPagamento ?? new Date(), "yyyy-MM-dd"),
        p_idempotency_key: inflightKeyRef.current,
      } as never);

      if (error) throw error;
    },
    onSuccess: () => {
      inflightKeyRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["faturas"] });
      queryClient.invalidateQueries({ queryKey: ["cartoes-resumo"] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos-paginados"] });
    },
    // Não limpamos a key em onError: retry deve usar a mesma chave para
    // ser reconhecido como idempotente pelo backend.
  });
}
