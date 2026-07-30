// Etapas (colunas) de tarefa por empresa (spec 014 · Kanban customizável).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import type { StatusBucket } from "./status";

export type Etapa = {
  id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  /** Âncora de status (a_fazer/fazendo/concluida); null = coluna extra só de tarefa. */
  bucket: StatusBucket | null;
};

const KEY = ["meu-trabalho", "etapas"] as const;

export function useEtapas() {
  return useQuery({
    queryKey: KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Etapa[]> => {
      const { data, error } = await supabase
        .from("tarefa_etapas")
        .select("id, nome, ordem, cor, bucket")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, bucket: (e.bucket as StatusBucket | null) ?? null }));
    },
  });
}

export function useEtapaMutations() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const criar = useMutation({
    mutationFn: async ({ nome, ordem }: { nome: string; ordem: number }) => {
      const empresaId = profile?.empresa_id;
      if (!empresaId) throw new Error("Sem empresa no perfil");
      const { data, error } = await supabase
        .from("tarefa_etapas")
        .insert({ empresa_id: empresaId, nome, ordem })
        .select("id, nome, ordem, cor, bucket")
        .single();
      if (error) throw error;
      return data as Etapa;
    },
    onSuccess: invalidate,
  });

  const renomear = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("tarefa_etapas").update({ nome }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Troca a ordem de duas etapas (usado pelos botões mover esquerda/direita).
  const reordenar = useMutation({
    mutationFn: async (pares: { id: string; ordem: number }[]) => {
      for (const p of pares) {
        const { error } = await supabase.from("tarefa_etapas").update({ ordem: p.ordem }).eq("id", p.id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      // ON DELETE SET NULL solta as tarefas (viram "Sem etapa"), sem perdê-las.
      const { error } = await supabase.from("tarefa_etapas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["meu-trabalho", "tarefas"] });
    },
  });

  return { criar, renomear, reordenar, excluir };
}
