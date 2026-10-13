import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RdoVisita {
  id: string;
  rdo_id: string;
  fornecedor_id: string | null;
  fornecedor_nome: string | null;
  observacao: string | null;
  fornecedor: { id: string; nome: string } | null;
}

const key = (obraId: string) => ["obra_rdo_visita", obraId] as const;

/** Todas as visitas lançadas nos dias de uma obra. */
export function useObraRdoVisitas(obraId: string | undefined) {
  return useQuery({
    queryKey: key(obraId ?? ""),
    enabled: !!obraId,
    queryFn: async (): Promise<RdoVisita[]> => {
      const { data, error } = await supabase
        .from("obra_rdo_visita")
        .select(
          "id, rdo_id, fornecedor_id, fornecedor_nome, observacao, fornecedor:fornecedores(id, nome), obra_rdo!inner(obra_id)"
        )
        .eq("obra_rdo.obra_id", obraId!)
        .returns<RdoVisita[]>();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export interface EntradaVisita {
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  observacao?: string | null;
}

/** Substitui o conjunto de visitas de um dia (mesmo padrão de useSaveRdoTarefas). */
export function useSaveRdoVisitas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rdoId,
      entradas,
    }: {
      rdoId: string;
      obraId: string;
      entradas: EntradaVisita[];
    }): Promise<void> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

      const { error: delErr } = await supabase.from("obra_rdo_visita").delete().eq("rdo_id", rdoId);
      if (delErr) throw delErr;

      if (entradas.length > 0) {
        const rows = entradas.map((e) => ({
          empresa_id: empresaId,
          rdo_id: rdoId,
          fornecedor_id: e.fornecedor_id || null,
          fornecedor_nome: e.fornecedor_nome?.trim() || null,
          observacao: e.observacao?.trim() || null,
        }));
        const { error: insErr } = await supabase.from("obra_rdo_visita").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_data, { obraId }) => {
      qc.invalidateQueries({ queryKey: key(obraId) });
    },
  });
}
