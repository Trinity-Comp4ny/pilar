import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MetaProgresso } from "@/lib/metas";

export const METAS_PROGRESSO_KEY = ["metas-progresso"] as const;

/**
 * Progresso de todas as metas no período corrente (SPEC 123). O valor de meta com
 * indicador é calculado no banco por `rpc_metas_progresso`, uma chamada por carga.
 */
export function useMetasProgresso(enabled = true) {
  return useQuery({
    queryKey: METAS_PROGRESSO_KEY,
    enabled,
    queryFn: async (): Promise<Map<string, MetaProgresso>> => {
      const { data, error } = await supabase.rpc("rpc_metas_progresso");
      if (error) throw error;
      return new Map((data ?? []).map((p) => [p.meta_id, p]));
    },
  });
}

export interface MetaPeriodo {
  janela_inicio: string;
  janela_fim: string;
  atual: number | null;
  restrito: boolean;
}

/** Últimos períodos de uma meta recorrente (o corrente primeiro). */
export function useMetaHistorico(metaId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["metas-historico", metaId],
    enabled,
    queryFn: async (): Promise<MetaPeriodo[]> => {
      const { data, error } = await supabase.rpc("rpc_meta_historico", { p_meta_id: metaId, p_periodos: 6 });
      if (error) throw error;
      return data ?? [];
    },
  });
}
