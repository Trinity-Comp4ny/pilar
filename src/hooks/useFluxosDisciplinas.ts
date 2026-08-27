import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { FluxoDisciplinas, FluxoInsert } from "@/types/fluxoDisciplinas";
import { normalizeFluxoDisciplinas } from "@/types/fluxoDisciplinas";

/**
 * A coluna no banco (`fluxos_disciplinas.etapas`) mantém o nome histórico —
 * sem migration, é `Json` — mas o shape em memória é a lista flat de
 * disciplinas (spec 067). `normalizeFluxoDisciplinas` também acha fluxos
 * salvos no formato antigo (etapa nomeada envolvendo disciplinas).
 */
export const useFluxosDisciplinas = () => {
  return useQuery({
    queryKey: ["fluxos-disciplinas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fluxos_disciplinas")
        .select("*")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("nome");

      if (error) throw error;

      return (data || []).map((f) => ({
        ...f,
        disciplinas: normalizeFluxoDisciplinas(f.etapas),
      })) as FluxoDisciplinas[];
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useCreateFluxo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fluxo: FluxoInsert) => {
      const { data, error } = await supabase
        .from("fluxos_disciplinas")
        .insert({
          nome: fluxo.nome,
          descricao: fluxo.descricao || null,
          etapas: fluxo.disciplinas as unknown as Json,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fluxos-disciplinas"] });
    },
  });
};

export const useUpdateFluxo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fluxo }: FluxoInsert & { id: string }) => {
      const { data, error } = await supabase
        .from("fluxos_disciplinas")
        .update({
          nome: fluxo.nome,
          descricao: fluxo.descricao || null,
          etapas: fluxo.disciplinas as unknown as Json,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fluxos-disciplinas"] });
    },
  });
};

export const useDeleteFluxo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fluxos_disciplinas").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fluxos-disciplinas"] });
    },
  });
};
