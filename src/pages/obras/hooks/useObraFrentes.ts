import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ObraFrenteRow = Tables<"obra_frente">;

const frentesKey = (obraId: string) => ["obra_frente", obraId] as const;

async function buscarNos(obraId: string): Promise<ObraFrenteRow[]> {
  const { data, error } = await supabase
    .from("obra_frente")
    .select("*")
    .eq("obra_id", obraId)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Todos os nós do cronograma da obra (fase, etapa e serviço, spec 111). Para a
 * árvore, montar com `montarArvoreCronograma` (src/lib/obraArvore.ts).
 */
export function useObraFrentes(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_frente", obraId],
    enabled: !!obraId,
    queryFn: () => buscarNos(obraId!),
    staleTime: 1000 * 60 * 2,
  });
}

/** Ordena as etapas pela posição da fase e depois pela da etapa. */
export function etapasEmOrdem(nos: ReadonlyArray<ObraFrenteRow>): ObraFrenteRow[] {
  const ordemFase = new Map(nos.filter((n) => n.nivel === "fase").map((f) => [f.id, f.ordem]));
  return nos
    .filter((n) => n.nivel === "etapa")
    .sort(
      (a, b) =>
        (ordemFase.get(a.parent_id ?? "") ?? 0) - (ordemFase.get(b.parent_id ?? "") ?? 0) ||
        a.ordem - b.ordem ||
        a.created_at.localeCompare(b.created_at)
    );
}

/**
 * Só as etapas, para quem amarra dinheiro e material à etapa (conta, cotação,
 * estoque, orçamento). Mesmo cache de `useObraFrentes`.
 */
export function useObraEtapas(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_frente", obraId],
    enabled: !!obraId,
    queryFn: () => buscarNos(obraId!),
    select: etapasEmOrdem,
    staleTime: 1000 * 60 * 2,
  });
}

export interface NovaFrente {
  nome: string;
  ordem: number;
  nivel: "fase" | "etapa" | "servico";
  parent_id: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
}

export function useCreateFrente(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      nome,
      ordem,
      nivel,
      parent_id,
      data_inicio,
      data_fim,
    }: NovaFrente): Promise<ObraFrenteRow> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { data, error } = await supabase
        .from("obra_frente")
        .insert({ empresa_id: empresaId, obra_id: obraId, nome, ordem, nivel, parent_id, data_inicio, data_fim })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: frentesKey(obraId) }),
  });
}

export interface AtualizaFrente {
  id: string;
  nome?: string;
  ordem?: number;
  data_inicio?: string | null;
  data_fim?: string | null;
}

export function useUpdateFrente(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...campos }: AtualizaFrente): Promise<void> => {
      const { error } = await supabase.from("obra_frente").update(campos).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: frentesKey(obraId) }),
  });
}

/**
 * Remove o nó e tudo abaixo dele (parent_id ON DELETE CASCADE). As tarefas ficam
 * na obra, sem serviço (obra_frente_id vira null via FK ON DELETE SET NULL).
 */
export function useDeleteFrente(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("obra_frente").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: frentesKey(obraId) });
      qc.invalidateQueries({ queryKey: ["obra_tarefas", obraId] });
    },
  });
}
