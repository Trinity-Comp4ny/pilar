import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProjetoDisciplinaDB } from "@/types/projetos";

interface RawDisciplinaRow {
  id: string;
  projeto_id: string;
  nome: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  data_fim_real: string | null;
  observacoes: string | null;
  prioridade: string | null;
  justificativa_atraso: string | null;
  horas_estimadas: number;
  custo_hora: number;
  created_at: string;
  updated_at: string;
  projeto_disciplina_responsaveis: Array<{
    pessoa_id: string;
    pessoas: { id: string; nome: string };
  }>;
}

function mapRowToDb(row: RawDisciplinaRow): ProjetoDisciplinaDB {
  return {
    id: row.id,
    projeto_id: row.projeto_id,
    nome: row.nome,
    status: row.status,
    data_inicio: row.data_inicio,
    data_fim: row.data_fim,
    data_fim_real: row.data_fim_real,
    observacoes: row.observacoes,
    prioridade: row.prioridade,
    justificativa_atraso: row.justificativa_atraso,
    horas_estimadas: row.horas_estimadas,
    custo_hora: row.custo_hora,
    created_at: row.created_at,
    updated_at: row.updated_at,
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
  custo_hora?: number;
  ordem_etapa?: number | null;
  responsavel_ids?: string[];
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
      } = input;

      let disciplinaId = id;

      if (disciplinaId) {
        const { error } = await supabase
          .from("projeto_disciplinas")
          .update({
            nome,
            status,
            data_inicio: data_inicio || null,
            data_fim: data_fim || null,
            data_fim_real: data_fim_real || null,
            observacoes: observacoes || null,
            prioridade: prioridade || null,
            justificativa_atraso: justificativa_atraso || null,
            horas_estimadas,
            custo_hora,
            ...(ordem_etapa !== null && ordem_etapa !== undefined ? { ordem_etapa } : {}),
            updated_at: new Date().toISOString(),
          } as never)
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
            custo_hora,
            ...(ordem_etapa !== null && ordem_etapa !== undefined ? { ordem_etapa } : {}),
          } as never)
          .select("id")
          .single();

        if (error) throw error;
        disciplinaId = data.id;
      }

      // Sync responsaveis: delete all then re-insert
      if (disciplinaId) {
        await supabase.from("projeto_disciplina_responsaveis").delete().eq("projeto_disciplina_id", disciplinaId);

        if (responsavel_ids.length > 0) {
          const rows = responsavel_ids.map((pessoa_id) => ({
            projeto_disciplina_id: disciplinaId!,
            pessoa_id,
          }));

          const { error: respError } = await supabase.from("projeto_disciplina_responsaveis").insert(rows);

          if (respError) throw respError;
        }
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

      const { error } = await supabase.from("projeto_disciplinas").update(updatePayload).eq("id", id);

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
        }

        // Sync responsaveis
        await supabase.from("projeto_disciplina_responsaveis").delete().eq("projeto_disciplina_id", discId!);

        if (disc.responsavel_ids.length > 0) {
          const rows = disc.responsavel_ids.map((pessoa_id) => ({
            projeto_disciplina_id: discId!,
            pessoa_id,
          }));
          const { error: respError } = await supabase.from("projeto_disciplina_responsaveis").insert(rows);
          if (respError) throw respError;
        }
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
