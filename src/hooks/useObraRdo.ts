import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type RdoRow = Tables<"obra_rdo">;
export type RdoInput = Omit<TablesInsert<"obra_rdo">, "empresa_id" | "created_by">;

const rdoKey = (obraId: string) => ["obra_rdo", obraId] as const;

/** Diário da obra em ordem decrescente de data (mais recente no topo). */
export function useObraRdos(obraId: string | undefined) {
  return useQuery({
    queryKey: ["obra_rdo", obraId],
    enabled: !!obraId,
    queryFn: async (): Promise<RdoRow[]> => {
      const { data, error } = await supabase
        .from("obra_rdo")
        .select("*")
        .eq("obra_id", obraId!)
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

/** Nome de quem lançou cada RDO (feed, spec 087) — id → nome, a partir dos
 * `created_by` já presentes nos RDOs carregados (sem query nova por linha). */
export function useObraRdoAutores(rdos: RdoRow[]) {
  const ids = [...new Set(rdos.map((r) => r.created_by).filter((v): v is string => !!v))].sort();
  return useQuery({
    queryKey: ["obra_rdo_autores", ids],
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from("profiles").select("id, nome, first_name").in("id", ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.nome || p.first_name || "Alguém"]));
    },
  });
}

export function useCreateRdo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RdoInput): Promise<RdoRow> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { data, error } = await supabase
        .from("obra_rdo")
        .insert({ ...input, empresa_id: empresaId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (rdo) => qc.invalidateQueries({ queryKey: rdoKey(rdo.obra_id) }),
  });
}

export function useUpdateRdo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: TablesUpdate<"obra_rdo"> & { id: string }): Promise<RdoRow> => {
      const { data, error } = await supabase.from("obra_rdo").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (rdo) => qc.invalidateQueries({ queryKey: rdoKey(rdo.obra_id) }),
  });
}

export function useDeleteRdo(obraId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from("obra_rdo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: rdoKey(obraId) }),
  });
}
