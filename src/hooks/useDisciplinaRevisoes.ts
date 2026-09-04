import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjetoDisciplinaRevisao } from "@/types/projetos";

interface RevisaoRow {
  id: string;
  motivo: string;
  solicitada_em: string;
  concluida_em: string | null;
  registrada_por_pessoa: { nome: string } | null;
  concluida_por_pessoa: { nome: string } | null;
}

function toRevisao(row: RevisaoRow): ProjetoDisciplinaRevisao {
  return {
    id: row.id,
    motivo: row.motivo,
    solicitada_em: row.solicitada_em,
    registrada_por_nome: row.registrada_por_pessoa?.nome ?? null,
    concluida_em: row.concluida_em,
    concluida_por_nome: row.concluida_por_pessoa?.nome ?? null,
  };
}

/** A revisão ainda aberta da disciplina, se houver (o banco garante no máximo uma). */
export function revisaoAberta(revisoes: ProjetoDisciplinaRevisao[]): ProjetoDisciplinaRevisao | undefined {
  return revisoes.find((r) => !r.concluida_em);
}

/** Histórico de revisões de uma disciplina + ações de registrar/concluir (spec 093). */
export function useDisciplinaRevisoes(disciplinaId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["disciplina-revisoes", disciplinaId],
    queryFn: async () => {
      if (!disciplinaId) return [] as ProjetoDisciplinaRevisao[];
      const { data, error } = await supabase
        .from("projeto_disciplina_revisoes")
        .select(
          "id, motivo, solicitada_em, concluida_em, " +
            "registrada_por_pessoa:pessoas!projeto_disciplina_revisoes_registrada_por_fkey(nome), " +
            "concluida_por_pessoa:pessoas!projeto_disciplina_revisoes_concluida_por_fkey(nome)"
        )
        .eq("projeto_disciplina_id", disciplinaId)
        .order("solicitada_em", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => toRevisao(row as unknown as RevisaoRow));
    },
    enabled: !!disciplinaId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["disciplina-revisoes", disciplinaId] });
    queryClient.invalidateQueries({ queryKey: ["projeto-disciplina-revisoes-counts"] });
  };

  const registrar = useMutation({
    mutationFn: async ({ motivo, solicitadaEm }: { motivo: string; solicitadaEm?: string }) => {
      if (!disciplinaId) throw new Error("Disciplina ainda não foi salva");
      const { error } = await supabase.rpc("rpc_registrar_revisao", {
        p_disciplina_id: disciplinaId,
        p_motivo: motivo,
        ...(solicitadaEm ? { p_solicitada_em: solicitadaEm } : {}),
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const concluir = useMutation({
    mutationFn: async (revisaoId: string) => {
      const { error } = await supabase.rpc("rpc_concluir_revisao", { p_revisao_id: revisaoId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { ...query, registrar, concluir };
}

/** Contagem de revisões por disciplina do projeto, para os badges da listagem.
 *  Espelha o formato de useProjetoDisciplinaChecklistCounts: um mapa por id. */
export function useProjetoDisciplinaRevisoesCounts(projetoId: string | undefined) {
  return useQuery({
    queryKey: ["projeto-disciplina-revisoes-counts", projetoId],
    queryFn: async () => {
      if (!projetoId) return {} as Record<string, { total: number; abertas: number }>;
      const { data, error } = await supabase
        .from("projeto_disciplina_revisoes")
        .select("projeto_disciplina_id, concluida_em, projeto_disciplinas!inner(projeto_id)")
        .eq("projeto_disciplinas.projeto_id", projetoId);
      if (error) throw error;

      const counts: Record<string, { total: number; abertas: number }> = {};
      for (const row of data ?? []) {
        const id = (row as { projeto_disciplina_id: string }).projeto_disciplina_id;
        const concluida = (row as { concluida_em: string | null }).concluida_em;
        const atual = counts[id] ?? { total: 0, abertas: 0 };
        counts[id] = { total: atual.total + 1, abertas: atual.abertas + (concluida ? 0 : 1) };
      }
      return counts;
    },
    enabled: !!projetoId,
  });
}
