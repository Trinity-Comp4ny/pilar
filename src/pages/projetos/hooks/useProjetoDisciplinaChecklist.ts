import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChecklistItem {
  id: string;
  texto: string;
  concluido: boolean;
  ordem: number;
}

export interface ChecklistCounts {
  total: number;
  concluidos: number;
}

interface ChecklistCountRow {
  projeto_disciplina_id: string;
  concluido: boolean;
}

/**
 * Contagem agregada por disciplina, para o projeto inteiro de uma vez: usada
 * pelo badge do grafo (FluxoPipeline) e pelo guard do dropdown de status
 * manual (que não pode deixar marcar "Concluído" com checklist incompleto).
 */
export function useProjetoDisciplinaChecklistCounts(projetoId: string | undefined) {
  return useQuery({
    queryKey: ["projeto-disciplina-checklist-counts", projetoId],
    queryFn: async () => {
      if (!projetoId) return {} as Record<string, ChecklistCounts>;

      const { data, error } = await supabase
        .from("projeto_disciplina_checklist")
        .select("projeto_disciplina_id, concluido, projeto_disciplinas!inner(projeto_id)")
        .eq("projeto_disciplinas.projeto_id", projetoId);

      if (error) throw error;

      const map: Record<string, ChecklistCounts> = {};
      for (const row of (data ?? []) as unknown as ChecklistCountRow[]) {
        const entry = (map[row.projeto_disciplina_id] ??= { total: 0, concluidos: 0 });
        entry.total++;
        if (row.concluido) entry.concluidos++;
      }
      return map;
    },
    enabled: !!projetoId,
    staleTime: 1000 * 30,
  });
}

/** CRUD completo do checklist de uma disciplina, usado dentro do dialog de detalhe. */
export function useDisciplinaChecklist(disciplinaId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["disciplina-checklist", disciplinaId],
    queryFn: async () => {
      if (!disciplinaId) return [] as ChecklistItem[];
      const { data, error } = await supabase
        .from("projeto_disciplina_checklist")
        .select("id, texto, concluido, ordem")
        .eq("projeto_disciplina_id", disciplinaId)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as ChecklistItem[];
    },
    enabled: !!disciplinaId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["disciplina-checklist", disciplinaId] });
    queryClient.invalidateQueries({ queryKey: ["projeto-disciplina-checklist-counts"] });
    queryClient.invalidateQueries({ queryKey: ["projeto-disciplinas"] });
  };

  const addItem = useMutation({
    mutationFn: async (texto: string) => {
      if (!disciplinaId) throw new Error("Disciplina ainda não foi salva");
      const ordem = query.data?.length ?? 0;
      const { error } = await supabase
        .from("projeto_disciplina_checklist")
        .insert({ projeto_disciplina_id: disciplinaId, texto, ordem });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean }) => {
      const { error } = await supabase.from("projeto_disciplina_checklist").update({ concluido }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projeto_disciplina_checklist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, addItem, toggleItem, removeItem };
}
