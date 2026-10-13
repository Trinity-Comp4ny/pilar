import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { calcularAvanco } from "@/lib/obras";
import { softDelete } from "@/lib/softDelete";

export type ObraRow = Tables<"obras">;

type Ref = { id: string; nome: string } | null;

export interface ObraResumo extends ObraRow {
  projeto: Ref;
  responsavel: Ref;
  /** % de tarefas concluídas nas frentes (determinístico, spec 015). */
  avanco: number;
}

const OBRAS_KEY = ["obras"] as const;
const SELECT = "*, projeto:projetos(id, nome), responsavel:pessoas(id, nome)";

/** Lista de obras da empresa com projeto, responsável e avanço. */
export function useObras() {
  return useQuery({
    queryKey: [...OBRAS_KEY, "lista"],
    queryFn: async (): Promise<ObraResumo[]> => {
      const { data: obras, error } = await supabase
        .from("obras")
        .select(SELECT)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .returns<Array<ObraRow & { projeto: Ref; responsavel: Ref }>>();
      if (error) throw error;

      const { data: tarefas, error: tErr } = await supabase
        .from("tarefas")
        .select("obra_id, status")
        .not("obra_id", "is", null);
      if (tErr) throw tErr;

      const porObra = new Map<string, { status: string }[]>();
      for (const t of tarefas ?? []) {
        if (!t.obra_id) continue;
        const arr = porObra.get(t.obra_id) ?? [];
        arr.push({ status: t.status });
        porObra.set(t.obra_id, arr);
      }

      return (obras ?? []).map((o) => ({ ...o, avanco: calcularAvanco(porObra.get(o.id) ?? []) }));
    },
    staleTime: 1000 * 60 * 3,
  });
}

/** Uma obra pelo id, com projeto, responsável e avanço. */
export function useObra(id: string | undefined) {
  return useQuery({
    queryKey: [...OBRAS_KEY, "detalhe", id],
    enabled: !!id,
    queryFn: async (): Promise<ObraResumo | null> => {
      const { data, error } = await supabase
        .from("obras")
        .select(SELECT)
        .eq("id", id!)
        .is("deleted_at", null)
        .maybeSingle<ObraRow & { projeto: Ref; responsavel: Ref }>();
      if (error) throw error;
      if (!data) return null;

      const { data: tarefas, error: tErr } = await supabase.from("tarefas").select("status").eq("obra_id", id!);
      if (tErr) throw tErr;

      return { ...data, avanco: calcularAvanco(tarefas ?? []) };
    },
  });
}

export type ObraInput = Omit<TablesInsert<"obras">, "empresa_id" | "created_by">;

export function useCreateObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ObraInput): Promise<ObraRow> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { data, error } = await supabase
        .from("obras")
        .insert({ ...input, empresa_id: empresaId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: OBRAS_KEY }),
  });
}

export function useUpdateObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: TablesUpdate<"obras"> & { id: string }): Promise<ObraRow> => {
      const { data, error } = await supabase.from("obras").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: OBRAS_KEY }),
  });
}

/** Soft delete (padrão do app): marca deleted_at. */
export function useDeleteObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      // Via RPC: a policy de SELECT esconde deletado, então UPDATE direto leva 42501.
      const error = await softDelete("obras", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: OBRAS_KEY }),
  });
}
