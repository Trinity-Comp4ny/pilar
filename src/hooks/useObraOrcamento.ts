import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ObraOrcamentoRow = Tables<"obra_orcamento_etapa">;

const orcamentoKey = (obraId: string) => ["obra_orcamento", obraId] as const;

/** Orçamento previsto por grande etapa (frente) de uma obra. */
export function useObraOrcamento(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_orcamento", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<ObraOrcamentoRow[]> => {
      const { data, error } = await supabase.from("obra_orcamento_etapa").select("*").eq("obra_id", obraId!);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

/** Define/atualiza o previsto de uma etapa (upsert por obra + frente). */
export function useSaveOrcamentoEtapa(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      obraFrenteId,
      valorPrevisto,
    }: {
      obraFrenteId: string;
      valorPrevisto: number;
    }): Promise<void> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { error } = await supabase
        .from("obra_orcamento_etapa")
        .upsert(
          { empresa_id: empresaId, obra_id: obraId, obra_frente_id: obraFrenteId, valor_previsto: valorPrevisto },
          { onConflict: "obra_id,obra_frente_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: orcamentoKey(obraId) }),
  });
}
