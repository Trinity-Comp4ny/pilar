// Etapas (colunas) de projeto por empresa — Kanban de projetos customizável.
// Espelha useEtapas.ts (tarefa), com uma diferença: o `bucket` é obrigatório e
// vale um dos 6 status canônicos (ProjectStatus). O projetos.status deriva do
// bucket via trigger no banco, então as regras de negócio seguem intactas.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PROJECT_STATUS, type ProjectStatus } from "@/constants";

export type ProjetoEtapa = {
  id: string;
  nome: string;
  ordem: number;
  cor: string | null;
  /** Âncora de status: qual dos 6 status canônicos esta coluna representa. */
  bucket: ProjectStatus;
};

const KEY = ["projetos", "etapas"] as const;

export function useProjetoEtapas() {
  return useQuery({
    queryKey: KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ProjetoEtapa[]> => {
      const { data, error } = await supabase
        .from("projeto_etapas")
        .select("id, nome, ordem, cor, bucket")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, bucket: e.bucket as ProjectStatus }));
    },
  });
}

export function useProjetoEtapaMutations() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  const criar = useMutation({
    mutationFn: async ({
      nome,
      ordem,
      cor,
      bucket,
    }: {
      nome: string;
      ordem: number;
      cor?: string | null;
      bucket?: ProjectStatus;
    }) => {
      const empresaId = profile?.empresa_id;
      if (!empresaId) throw new Error("Sem empresa no perfil");
      const { data, error } = await supabase
        .from("projeto_etapas")
        .insert({ empresa_id: empresaId, nome, ordem, cor: cor ?? null, bucket: bucket ?? PROJECT_STATUS.EM_ANDAMENTO })
        .select("id, nome, ordem, cor, bucket")
        .single();
      if (error) throw error;
      return { ...data, bucket: data.bucket as ProjectStatus } as ProjetoEtapa;
    },
    onSuccess: invalidate,
  });

  const renomear = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("projeto_etapas").update({ nome }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Troca a ordem de duas etapas (botões mover esquerda/direita).
  const reordenar = useMutation({
    mutationFn: async (pares: { id: string; ordem: number }[]) => {
      for (const p of pares) {
        const { error } = await supabase.from("projeto_etapas").update({ ordem: p.ordem }).eq("id", p.id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  // ON DELETE RESTRICT: o banco recusa apagar coluna com projeto dentro; o front
  // bloqueia antes com mensagem amigável, mas mantemos o erro como rede de proteção.
  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projeto_etapas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["projetos"] });
    },
  });

  return { criar, renomear, reordenar, excluir };
}
