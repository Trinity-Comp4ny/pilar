import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type TarefaRow = Tables<"tarefas">;

export interface ObraTarefa extends TarefaRow {
  responsavel: { id: string; nome: string } | null;
  /** Conjunto de responsáveis (ponte tarefa_responsaveis), o mesmo da gestão de tarefas. */
  responsaveis: { pessoa: { id: string; nome: string } | null }[];
}

const tarefasKey = (obraId: string) => ["obra_tarefas", obraId] as const;

/** Tarefas (pendências de campo) de uma obra — reusa a tabela `tarefas`. */
export function useObraTarefas(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_tarefas", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<ObraTarefa[]> => {
      const { data, error } = await supabase
        .from("tarefas")
        // Desambigua o embed: após a tabela-ponte tarefa_responsaveis, há dois
        // caminhos tarefas↔pessoas; fixa o responsável primário pela FK direta.
        .select(
          "*, responsavel:pessoas!tarefas_responsavel_id_fkey(id, nome), responsaveis:tarefa_responsaveis(pessoa:pessoas(id, nome))"
        )
        .eq("obra_id", obraId!)
        .order("created_at", { ascending: true })
        .returns<ObraTarefa[]>();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

/** A tarefa da obra também aparece na gestão de tarefas: as duas telas se invalidam. */
function invalidarTarefas(qc: ReturnType<typeof useQueryClient>, obraId: string) {
  qc.invalidateQueries({ queryKey: tarefasKey(obraId) });
  qc.invalidateQueries({ queryKey: ["obras"] });
  qc.invalidateQueries({ queryKey: ["meu-trabalho", "tarefas"] });
}

export interface NovaObraTarefa {
  titulo: string;
  obra_frente_id: string | null;
  responsavel_id?: string | null;
  data_inicio?: string | null;
  prazo?: string | null;
}

/**
 * Cria tarefa de obra. Se a obra estiver ligada a um projeto, herda projeto_id
 * para a tarefa aparecer no "Meu trabalho" com o projeto (spec 015, req. 6).
 * Obra sem projeto gera tarefa avulsa (projeto_id nulo).
 */
export function useCreateObraTarefa(obraId: string, projetoId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NovaObraTarefa): Promise<TarefaRow> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { data, error } = await supabase
        .from("tarefas")
        .insert({
          empresa_id: empresaId,
          obra_id: obraId,
          projeto_id: projetoId,
          obra_frente_id: input.obra_frente_id,
          titulo: input.titulo,
          responsavel_id: input.responsavel_id ?? null,
          data_inicio: input.data_inicio ?? null,
          prazo: input.prazo ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidarTarefas(qc, obraId),
  });
}

export type PatchObraTarefa = { id: string } & Partial<
  Pick<
    TarefaRow,
    | "status"
    | "titulo"
    | "responsavel_id"
    | "data_inicio"
    | "prazo"
    | "obra_frente_id"
    | "sensivel_clima"
    | "sinalizada"
    | "labels"
  >
>;

/**
 * Atualiza a tarefa com resposta otimista: marcar o checklist precisa refletir no
 * avanço de serviço, etapa e fase na hora, sem esperar o refetch.
 */
export function useUpdateObraTarefa(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: PatchObraTarefa): Promise<void> => {
      const { error } = await supabase.from("tarefas").update(patch).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: tarefasKey(obraId) });
      const antes = qc.getQueryData<ObraTarefa[]>(tarefasKey(obraId));
      qc.setQueryData<ObraTarefa[]>(tarefasKey(obraId), (lista) =>
        lista?.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
      return { antes };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.antes) qc.setQueryData(tarefasKey(obraId), ctx.antes);
    },
    onSettled: () => invalidarTarefas(qc, obraId),
  });
}

export function useDeleteObraTarefa(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("tarefas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidarTarefas(qc, obraId),
  });
}
