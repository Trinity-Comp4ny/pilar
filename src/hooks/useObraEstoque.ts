import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { softDelete } from "@/lib/softDelete";

export type MaterialRow = Tables<"obra_material">;
export type MovimentoRow = Tables<"obra_material_mov">;
export type MaterialComMovimentos = MaterialRow & { movimentos: MovimentoRow[] };

const estoqueKey = (obraId: string) => ["obra_material", obraId] as const;

/**
 * Materiais de uma obra com seus movimentos embutidos (entradas e baixas). O embed
 * não aplica o filtro de soft-delete, então filtramos os movimentos removidos aqui,
 * como em useObraCotacoes.
 */
export function useObraEstoque(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_material", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<MaterialComMovimentos[]> => {
      const { data, error } = await supabase
        .from("obra_material")
        .select("*, movimentos:obra_material_mov(*)")
        .eq("obra_id", obraId!)
        .is("deleted_at", null)
        .order("nome", { ascending: true })
        .returns<MaterialComMovimentos[]>();
      if (error) throw error;
      return (data ?? []).map((m) => ({
        ...m,
        movimentos: (m.movimentos ?? [])
          .filter((mv) => !mv.deleted_at)
          .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0)),
      }));
    },
    staleTime: 1000 * 60 * 2,
  });
}

export type MaterialInput = {
  id?: string | null;
  nome: string;
  unidade: string;
  categoria?: string | null;
};

/** Cria ou edita um material da obra. Create devolve o id (usado no fluxo inline do movimento). */
export function useSaveMaterial(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: MaterialInput): Promise<string> => {
      if (id) {
        const { error } = await supabase.from("obra_material").update(input).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { data, error } = await supabase
        .from("obra_material")
        .insert({ ...input, empresa_id: empresaId, obra_id: obraId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: estoqueKey(obraId) }),
  });
}

/** Soft delete de um material (os movimentos caem junto por CASCADE se for hard delete; aqui só marcamos). */
export function useDeleteMaterial(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // Via RPC: a policy de SELECT esconde deletado, então UPDATE direto leva 42501.
      const error = await softDelete("obra_material", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: estoqueKey(obraId) }),
  });
}

export type MovimentoInput = {
  id?: string | null;
  obra_material_id: string;
  tipo: "entrada" | "baixa";
  quantidade: number;
  data: string;
  obra_frente_id?: string | null;
  valor_unitario?: number | null;
  observacoes?: string | null;
};

/** Cria ou edita um movimento de estoque (entrada = compra recebida, baixa = aplicado). */
export function useSaveMovimento(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: MovimentoInput): Promise<void> => {
      // Baixa não valoriza estoque: o custo vem das entradas (custo médio).
      const payload = { ...input, valor_unitario: input.tipo === "entrada" ? input.valor_unitario ?? null : null };
      if (id) {
        const { error } = await supabase.from("obra_material_mov").update(payload).eq("id", id);
        if (error) throw error;
        return;
      }
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { error } = await supabase
        .from("obra_material_mov")
        .insert({ ...payload, empresa_id: empresaId, obra_id: obraId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: estoqueKey(obraId) }),
  });
}

export function useDeleteMovimento(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const error = await softDelete("obra_material_mov", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: estoqueKey(obraId) }),
  });
}
