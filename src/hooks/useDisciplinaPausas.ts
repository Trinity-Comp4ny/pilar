import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjetoDisciplinaPausa } from "@/types/projetos";

interface PausaRow {
  id: string;
  motivo: string;
  pausado_em: string;
  retomado_em: string | null;
  pausado_por_pessoa: { nome: string } | null;
  retomado_por_pessoa: { nome: string } | null;
}

function toPausa(row: PausaRow): ProjetoDisciplinaPausa {
  return {
    id: row.id,
    motivo: row.motivo,
    pausado_em: row.pausado_em,
    pausado_por_nome: row.pausado_por_pessoa?.nome ?? null,
    retomado_em: row.retomado_em,
    retomado_por_nome: row.retomado_por_pessoa?.nome ?? null,
  };
}

/** Soma em dias das pausas (fechadas ou ainda abertas, contando até agora). */
export function totalDiasParados(pausas: ProjetoDisciplinaPausa[]): number {
  const MS_POR_DIA = 1000 * 60 * 60 * 24;
  return pausas.reduce((total, p) => {
    const inicio = new Date(p.pausado_em).getTime();
    const fim = p.retomado_em ? new Date(p.retomado_em).getTime() : Date.now();
    return total + Math.max(0, (fim - inicio) / MS_POR_DIA);
  }, 0);
}

/** Histórico de pausas de uma disciplina + ações de pausar/retomar (spec 083). */
export function useDisciplinaPausas(disciplinaId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["disciplina-pausas", disciplinaId],
    queryFn: async () => {
      if (!disciplinaId) return [] as ProjetoDisciplinaPausa[];
      const { data, error } = await supabase
        .from("projeto_disciplina_pausas")
        .select(
          "id, motivo, pausado_em, retomado_em, " +
            "pausado_por_pessoa:pessoas!projeto_disciplina_pausas_pausado_por_fkey(nome), " +
            "retomado_por_pessoa:pessoas!projeto_disciplina_pausas_retomado_por_fkey(nome)"
        )
        .eq("projeto_disciplina_id", disciplinaId)
        .order("pausado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => toPausa(row as unknown as PausaRow));
    },
    enabled: !!disciplinaId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["disciplina-pausas", disciplinaId] });
    queryClient.invalidateQueries({ queryKey: ["projeto-disciplinas"] });
  };

  const pausar = useMutation({
    mutationFn: async (motivo: string) => {
      if (!disciplinaId) throw new Error("Disciplina ainda não foi salva");
      const { error } = await supabase.rpc("rpc_pausar_disciplina", {
        p_disciplina_id: disciplinaId,
        p_motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const retomar = useMutation({
    mutationFn: async () => {
      if (!disciplinaId) throw new Error("Disciplina ainda não foi salva");
      const { error } = await supabase.rpc("rpc_retomar_disciplina", { p_disciplina_id: disciplinaId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, pausar, retomar };
}
