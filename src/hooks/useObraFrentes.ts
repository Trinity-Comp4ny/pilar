import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ObraFrenteRow = Tables<"obra_frente">;

const frentesKey = (obraId: string) => ["obra_frente", obraId] as const;

/** Frentes de serviço de uma obra, ordenadas. */
export function useObraFrentes(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_frente", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<ObraFrenteRow[]> => {
      const { data, error } = await supabase
        .from("obra_frente")
        .select("*")
        .eq("obra_id", obraId!)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export interface NovaFrente {
  nome: string;
  ordem: number;
  data_inicio?: string | null;
  data_fim?: string | null;
}

export function useCreateFrente(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, ordem, data_inicio, data_fim }: NovaFrente): Promise<ObraFrenteRow> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { data, error } = await supabase
        .from("obra_frente")
        .insert({ empresa_id: empresaId, obra_id: obraId, nome, ordem, data_inicio, data_fim })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: frentesKey(obraId) }),
  });
}

export interface AtualizaFrente {
  id: string;
  nome?: string;
  data_inicio?: string | null;
  data_fim?: string | null;
}

export function useUpdateFrente(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...campos }: AtualizaFrente): Promise<void> => {
      const { error } = await supabase.from("obra_frente").update(campos).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: frentesKey(obraId) }),
  });
}

/** Remove a frente; as tarefas ficam (obra_frente_id vira null via FK ON DELETE SET NULL). */
export function useDeleteFrente(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("obra_frente").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: frentesKey(obraId) });
      qc.invalidateQueries({ queryKey: ["obra_tarefas", obraId] });
    },
  });
}
