import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { contaDisciplinasAbertas } from "@/pages/projetos/lib/pausa";
import type { ProjetoPausa } from "@/types/projetos";

interface PausaRow {
  id: string;
  motivo: string;
  pausado_em: string;
  retomado_em: string | null;
  pausado_por_pessoa: { nome: string } | null;
  retomado_por_pessoa: { nome: string } | null;
}

interface DisciplinaAfetada {
  id: string;
  nome: string;
  data_fim: string | null;
}

interface AfetadaRow {
  projeto_disciplinas: { id: string; nome: string | null; data_fim: string | null } | null;
}

function toPausa(row: PausaRow): ProjetoPausa {
  return {
    id: row.id,
    motivo: row.motivo,
    pausado_em: row.pausado_em,
    pausado_por_nome: row.pausado_por_pessoa?.nome ?? null,
    retomado_em: row.retomado_em,
    retomado_por_nome: row.retomado_por_pessoa?.nome ?? null,
  };
}

/** Pausar/retomar mexem em projeto, disciplinas e no que o /inicio lista: invalida tudo junto. */
function invalidarPausaDoProjeto(queryClient: QueryClient, projetoId: string) {
  queryClient.invalidateQueries({ queryKey: ["projeto-pausas", projetoId] });
  queryClient.invalidateQueries({ queryKey: ["projeto-detail", projetoId] });
  queryClient.invalidateQueries({ queryKey: ["projeto-disciplinas", projetoId] });
  queryClient.invalidateQueries({ queryKey: ["projeto-timeline", projetoId] });
  queryClient.invalidateQueries({ queryKey: ["disciplina-pausas"] });
  queryClient.invalidateQueries({ queryKey: ["projetos"] });
  queryClient.invalidateQueries({ queryKey: ["painel-gestao"] });
}

async function pausarProjetoRpc(projetoId: string, motivo: string) {
  const { error } = await supabase.rpc("rpc_pausar_projeto", { p_projeto_id: projetoId, p_motivo: motivo });
  if (error) throw error;
}

/** `etapaId`: coluna de destino ao soltar no Kanban; sem ela volta para a de antes da pausa. */
async function retomarProjetoRpc(projetoId: string, etapaId?: string) {
  const { error } = await supabase.rpc("rpc_retomar_projeto", { p_projeto_id: projetoId, p_etapa_id: etapaId });
  if (error) throw error;
}

/** Histórico de pausas do projeto + disciplinas que a pausa aberta pausou (spec 141). */
export function useProjetoPausas(projetoId: string | undefined) {
  const queryClient = useQueryClient();

  const pausas = useQuery({
    queryKey: ["projeto-pausas", projetoId],
    queryFn: async () => {
      if (!projetoId) return [] as ProjetoPausa[];
      const { data, error } = await supabase
        .from("projeto_pausas")
        .select(
          "id, motivo, pausado_em, retomado_em, " +
            "pausado_por_pessoa:pessoas!projeto_pausas_pausado_por_fkey(nome), " +
            "retomado_por_pessoa:pessoas!projeto_pausas_retomado_por_fkey(nome)"
        )
        .eq("projeto_id", projetoId)
        .order("pausado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => toPausa(row as unknown as PausaRow));
    },
    enabled: !!projetoId,
  });

  const aberta = pausas.data?.find((p) => !p.retomado_em);

  const afetadas = useQuery({
    queryKey: ["projeto-pausa-disciplinas", aberta?.id],
    queryFn: async () => {
      if (!aberta) return [] as DisciplinaAfetada[];
      const { data, error } = await supabase
        .from("projeto_disciplina_pausas")
        .select("projeto_disciplinas(id, nome, data_fim)")
        .eq("projeto_pausa_id", aberta.id)
        .is("retomado_em", null);
      if (error) throw error;
      return ((data ?? []) as unknown as AfetadaRow[]).flatMap((row) =>
        row.projeto_disciplinas
          ? [
              {
                id: row.projeto_disciplinas.id,
                nome: row.projeto_disciplinas.nome ?? "Sem nome",
                data_fim: row.projeto_disciplinas.data_fim,
              },
            ]
          : []
      );
    },
    enabled: !!aberta,
  });

  const pausar = useMutation({
    mutationFn: async (motivo: string) => {
      if (!projetoId) throw new Error("Projeto ainda não foi salvo");
      await pausarProjetoRpc(projetoId, motivo);
    },
    onSuccess: () => projetoId && invalidarPausaDoProjeto(queryClient, projetoId),
  });

  const retomar = useMutation({
    mutationFn: async (etapaId?: string) => {
      if (!projetoId) throw new Error("Projeto ainda não foi salvo");
      await retomarProjetoRpc(projetoId, etapaId);
    },
    onSuccess: () => projetoId && invalidarPausaDoProjeto(queryClient, projetoId),
  });

  return { pausas, aberta, afetadas, pausar, retomar };
}

/** Quantas disciplinas uma pausa do projeto vai pausar (abertas e ainda não pausadas à parte). */
export function useDisciplinasAbertasDoProjeto(projetoId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["projeto-disciplinas-abertas", projetoId],
    queryFn: async () => {
      if (!projetoId) return 0;
      const { data, error } = await supabase.from("projeto_disciplinas").select("status").eq("projeto_id", projetoId);
      if (error) throw error;
      return contaDisciplinasAbertas((data ?? []).map((d) => d.status));
    },
    enabled: !!projetoId && enabled,
  });
}
