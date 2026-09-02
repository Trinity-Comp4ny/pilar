import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callUntypedRpc } from "@/lib/supabaseRpc";
import type { DisciplinaComentario, ProjetoDisciplinaDB } from "@/types/projetos";
import type { LinkItem } from "@/components/LinksEditor";
import type { FluxoChecklistItemTemplate } from "@/types/fluxoDisciplinas";

/**
 * Sincroniza responsáveis de uma disciplina de forma transacional (insere só os novos,
 * remove só os que saíram). Substitui o antigo DELETE all + INSERT fora de transação,
 * que deixava a disciplina sem responsável se o INSERT falhasse.
 */
async function syncResponsaveis(disciplinaId: string, responsavelIds: string[]) {
  const { error } = await callUntypedRpc("sync_disciplina_responsaveis", {
    p_disciplina_id: disciplinaId,
    p_pessoa_ids: responsavelIds,
  });
  if (error) throw error;
}

interface RawDisciplinaRow {
  id: string;
  projeto_id: string;
  codigo: string | null;
  nome: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  data_fim_real: string | null;
  observacoes: string | null;
  prioridade: string | null;
  justificativa_atraso: string | null;
  horas_estimadas: number;
  horas_realizadas: number | null;
  custo_hora: number;
  descricao: string | null;
  labels: string[] | null;
  links: LinkItem[] | null;
  comentarios: DisciplinaComentario[] | null;
  created_at: string;
  updated_at: string;
  ordem_etapa: number | null;
  projeto_disciplina_responsaveis: Array<{
    pessoa_id: string;
    pessoas: { id: string; nome: string };
  }>;
}

function mapRowToDb(row: RawDisciplinaRow): ProjetoDisciplinaDB {
  return {
    id: row.id,
    projeto_id: row.projeto_id,
    codigo: row.codigo,
    nome: row.nome,
    status: row.status,
    data_inicio: row.data_inicio,
    data_fim: row.data_fim,
    data_fim_real: row.data_fim_real,
    observacoes: row.observacoes,
    prioridade: row.prioridade,
    justificativa_atraso: row.justificativa_atraso,
    horas_estimadas: row.horas_estimadas,
    horas_realizadas: row.horas_realizadas ?? 0,
    custo_hora: row.custo_hora,
    descricao: row.descricao,
    labels: row.labels ?? [],
    links: row.links ?? [],
    comentarios: row.comentarios ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    ordem_etapa: row.ordem_etapa,
    responsaveis:
      row.projeto_disciplina_responsaveis?.map((r) => ({
        id: r.pessoas.id,
        nome: r.pessoas.nome,
      })) || [],
  };
}

export function useProjetoDisciplinas(projetoId: string | undefined) {
  return useQuery({
    queryKey: ["projeto-disciplinas", projetoId],
    queryFn: async () => {
      if (!projetoId) return [];

      const { data, error } = await supabase
        .from("projeto_disciplinas")
        .select(
          `
          *,
          projeto_disciplina_responsaveis (
            pessoa_id,
            pessoas ( id, nome )
          )
        `
        )
        .eq("projeto_id", projetoId)
        .order("created_at");

      if (error) throw error;

      return ((data as unknown as RawDisciplinaRow[]) || []).map(mapRowToDb);
    },
    enabled: !!projetoId,
    staleTime: 1000 * 60 * 2,
  });
}

interface UpsertDisciplinaInput {
  id?: string;
  projeto_id: string;
  nome: string;
  status?: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  data_fim_real?: string | null;
  observacoes?: string | null;
  prioridade?: string | null;
  justificativa_atraso?: string | null;
  horas_estimadas?: number;
  horas_realizadas?: number;
  custo_hora?: number;
  descricao?: string | null;
  comentarios?: DisciplinaComentario[];
  ordem_etapa?: number | null;
  responsavel_ids?: string[];
  labels?: string[];
  links?: LinkItem[];
}

export function useUpsertDisciplina() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpsertDisciplinaInput) => {
      const {
        id,
        projeto_id,
        nome,
        status = "Não Iniciado",
        data_inicio,
        data_fim,
        data_fim_real,
        observacoes,
        prioridade,
        justificativa_atraso,
        horas_estimadas = 0,
        custo_hora = 0,
        ordem_etapa = null,
        responsavel_ids = [],
        labels,
        links,
        horas_realizadas,
        descricao,
        comentarios,
      } = input;

      let disciplinaId = id;

      if (disciplinaId) {
        const updatePayload: Record<string, unknown> = {
          nome,
          status,
          data_inicio: data_inicio || null,
          data_fim: data_fim || null,
          data_fim_real: data_fim_real || null,
          prioridade: prioridade || null,
          justificativa_atraso: justificativa_atraso || null,
          horas_estimadas,
          custo_hora,
          ...(ordem_etapa !== null && ordem_etapa !== undefined ? { ordem_etapa } : {}),
          updated_at: new Date().toISOString(),
        };
        // observacoes só é sobrescrito quando explicitamente informado.
        // Assim adicionar/remover responsável (que não passa observacoes) não apaga
        // as observações já gravadas na disciplina.
        if (observacoes !== undefined) updatePayload.observacoes = observacoes || null;
        // labels/links/etc: mesma regra — só grava quando o chamador informa.
        if (labels !== undefined) updatePayload.labels = labels;
        if (links !== undefined) updatePayload.links = links;
        if (horas_realizadas !== undefined) updatePayload.horas_realizadas = horas_realizadas;
        if (descricao !== undefined) updatePayload.descricao = descricao || null;
        if (comentarios !== undefined) updatePayload.comentarios = comentarios;

        const { error } = await supabase
          .from("projeto_disciplinas")
          .update(updatePayload as never)
          .eq("id", disciplinaId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("projeto_disciplinas")
          .insert({
            projeto_id,
            nome,
            status,
            data_inicio: data_inicio || null,
            data_fim: data_fim || null,
            data_fim_real: data_fim_real || null,
            observacoes: observacoes || null,
            prioridade: prioridade || null,
            justificativa_atraso: justificativa_atraso || null,
            horas_estimadas,
            horas_realizadas: horas_realizadas ?? 0,
            custo_hora,
            descricao: descricao || null,
            labels: labels ?? [],
            links: links ?? [],
            comentarios: comentarios ?? [],
            ...(ordem_etapa !== null && ordem_etapa !== undefined ? { ordem_etapa } : {}),
          } as never)
          .select("id")
          .single();

        if (error) throw error;
        disciplinaId = data.id;
      }

      // Sync responsaveis transacional (insere novos, remove os que saíram)
      if (disciplinaId) {
        await syncResponsaveis(disciplinaId, responsavel_ids);
      }

      return disciplinaId;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["projeto-disciplinas", variables.projeto_id],
      });
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
    },
  });
}

export function useDeleteDisciplina() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, projetoId }: { id: string; projetoId: string }) => {
      const { error } = await supabase.from("projeto_disciplinas").delete().eq("id", id);

      if (error) throw error;
      return projetoId;
    },
    onSuccess: (projetoId) => {
      queryClient.invalidateQueries({
        queryKey: ["projeto-disciplinas", projetoId],
      });
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
    },
  });
}

export function useUpdateDisciplinaStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      projetoId,
      status,
      justificativa_atraso,
      data_fim_real,
    }: {
      id: string;
      projetoId: string;
      status: string;
      justificativa_atraso?: string;
      data_fim_real?: string;
    }) => {
      const updatePayload: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (justificativa_atraso !== undefined) {
        updatePayload.justificativa_atraso = justificativa_atraso;
      }

      if (data_fim_real !== undefined) {
        updatePayload.data_fim_real = data_fim_real;
      }

      const { error } = await supabase
        .from("projeto_disciplinas")
        .update(updatePayload as never)
        .eq("id", id);

      if (error) throw error;
      return { projetoId, id, status, justificativa_atraso, data_fim_real };
    },
    onMutate: async ({ id, projetoId, status, justificativa_atraso, data_fim_real }) => {
      await queryClient.cancelQueries({ queryKey: ["projeto-disciplinas", projetoId] });
      const snapshot = queryClient.getQueryData(["projeto-disciplinas", projetoId]);
      queryClient.setQueryData(["projeto-disciplinas", projetoId], (old: unknown) => {
        if (!Array.isArray(old)) return old;
        return old.map((d: RawDisciplinaRow) =>
          d.id === id
            ? {
                ...d,
                status,
                ...(justificativa_atraso !== undefined ? { justificativa_atraso } : {}),
                ...(data_fim_real !== undefined ? { data_fim_real } : {}),
              }
            : d
        );
      });
      return { snapshot, projetoId };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(["projeto-disciplinas", context.projetoId], context.snapshot);
      }
    },
    onSuccess: ({ projetoId }) => {
      queryClient.invalidateQueries({
        queryKey: ["projeto-disciplinas", projetoId],
      });
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
    },
  });
}

/**
 * Bulk-save disciplinas for a project (used by the form dialog).
 * Accepts the full list of disciplinas that SHOULD exist — deletes removed ones,
 * upserts everything else, and syncs responsaveis.
 */
export function useBulkSaveDisciplinas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projetoId,
      disciplinas,
    }: {
      projetoId: string;
      disciplinas: Array<{
        id?: string;
        nome: string;
        status?: string;
        data_inicio?: string | null;
        data_fim?: string | null;
        data_fim_real?: string | null;
        prioridade?: string | null;
        justificativa_atraso?: string | null;
        horas_estimadas?: number;
        custo_hora?: number;
        ordem_etapa?: number | null;
        checklist_padrao?: FluxoChecklistItemTemplate[];
        responsavel_ids: string[];
      }>;
    }) => {
      // Get current disciplinas for this project
      const { data: existing } = await supabase.from("projeto_disciplinas").select("id").eq("projeto_id", projetoId);

      const existingIds = new Set((existing || []).map((d) => d.id));
      const incomingIds = new Set(disciplinas.filter((d) => d.id).map((d) => d.id!));

      // Delete removed disciplinas
      const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
      if (toDelete.length > 0) {
        const { error } = await supabase.from("projeto_disciplinas").delete().in("id", toDelete);
        if (error) throw error;
      }

      // Upsert each disciplina
      for (const disc of disciplinas) {
        let discId = disc.id;

        const ordemEtapaPatch =
          disc.ordem_etapa !== null && disc.ordem_etapa !== undefined ? { ordem_etapa: disc.ordem_etapa } : {};

        if (discId && existingIds.has(discId)) {
          const { error } = await supabase
            .from("projeto_disciplinas")
            .update({
              nome: disc.nome,
              status: disc.status || "Não Iniciado",
              data_inicio: disc.data_inicio || null,
              data_fim: disc.data_fim || null,
              data_fim_real: disc.data_fim_real || null,
              prioridade: disc.prioridade || null,
              justificativa_atraso: disc.justificativa_atraso || null,
              horas_estimadas: disc.horas_estimadas || 0,
              custo_hora: disc.custo_hora || 0,
              ...ordemEtapaPatch,
              updated_at: new Date().toISOString(),
            } as never)
            .eq("id", discId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("projeto_disciplinas")
            .insert({
              projeto_id: projetoId,
              nome: disc.nome,
              status: disc.status || "Não Iniciado",
              data_inicio: disc.data_inicio || null,
              data_fim: disc.data_fim || null,
              data_fim_real: disc.data_fim_real || null,
              prioridade: disc.prioridade || null,
              justificativa_atraso: disc.justificativa_atraso || null,
              horas_estimadas: disc.horas_estimadas || 0,
              custo_hora: disc.custo_hora || 0,
              ...ordemEtapaPatch,
            } as never)
            .select("id")
            .single();
          if (error) throw error;
          discId = data.id;

          // Checklist padrão só é copiado na criação da disciplina (a partir
          // do template do fluxo aplicado); disciplina já existente não é tocada.
          if (disc.checklist_padrao?.length) {
            const { data: checklistRows, error: checklistError } = await supabase
              .from("projeto_disciplina_checklist")
              .insert(
                disc.checklist_padrao.map((item, i) => ({
                  projeto_disciplina_id: discId!,
                  texto: item.texto,
                  duracao_dias_uteis: item.duracao_dias_uteis ?? null,
                  ordem: i,
                }))
              )
              .select("id");
            if (checklistError) throw checklistError;

            // Responsáveis por tarefa (spec 071): cada item do checklist pode ter
            // os seus próprios, independente da disciplina. Só na criação, junto
            // com o checklist — não tem fluxo de edição posterior aqui ainda.
            const responsaveisRows = (checklistRows ?? []).flatMap((row, i) =>
              (disc.checklist_padrao![i].responsaveis_ids ?? []).map((pessoaId) => ({
                checklist_item_id: row.id,
                pessoa_id: pessoaId,
              }))
            );
            if (responsaveisRows.length > 0) {
              const { error: respError } = await supabase
                .from("projeto_disciplina_checklist_responsaveis")
                .insert(responsaveisRows);
              if (respError) throw respError;
            }
          }
        }

        // Sync responsaveis transacional (insere novos, remove os que saíram)
        await syncResponsaveis(discId!, disc.responsavel_ids);
      }

      return projetoId;
    },
    onSuccess: (projetoId) => {
      queryClient.invalidateQueries({
        queryKey: ["projeto-disciplinas", projetoId],
      });
      queryClient.invalidateQueries({ queryKey: ["projetos"] });
    },
  });
}
