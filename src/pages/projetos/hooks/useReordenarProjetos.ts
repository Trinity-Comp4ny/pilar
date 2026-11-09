import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSafeErrorMessage } from "@/lib/safeError";
import { type Projeto } from "@/types/projetos";

/**
 * Grava a ordem de prioridade dos projetos (SPEC 143): `ids` na sequência nova vira 1..N numa
 * só chamada. Atualiza o cache na hora; se o servidor recusar, devolve a lista como estava.
 */
export function useReordenarProjetos() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.rpc("rpc_reordenar_projetos", { p_ids: ids });
      if (error) throw error;
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ["projetos"] });
      const anterior = queryClient.getQueryData<Projeto[]>(["projetos"]);
      const posicao = new Map(ids.map((id, i) => [id, i + 1]));
      queryClient.setQueryData<Projeto[]>(["projetos"], (old) =>
        (old ?? []).map((p) => (posicao.has(p.id) ? { ...p, ordem_prioridade: posicao.get(p.id) } : p))
      );
      return { anterior };
    },
    onError: (error, _ids, contexto) => {
      queryClient.setQueryData(["projetos"], contexto?.anterior);
      toast.error("Não foi possível salvar a ordem", {
        description: getSafeErrorMessage(error, "A lista voltou à ordem anterior. Tente de novo."),
      });
    },
    onSuccess: () => toast.success("Ordem de prioridade salva"),
  });
}
