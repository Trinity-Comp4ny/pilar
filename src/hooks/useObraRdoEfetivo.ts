import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Linha de efetivo por fornecedor de um dia, já com o nome resolvido. */
export interface RdoEfetivoLinha {
  id: string;
  rdo_id: string;
  fornecedor_id: string | null;
  fornecedor_nome: string | null;
  quantidade: number;
  fornecedor: { id: string; nome: string } | null;
}

const key = (obraId: string) => ["obra_rdo_efetivo", obraId] as const;

/** Todo o efetivo por fornecedor lançado nos dias de uma obra. */
export function useObraRdoEfetivo(obraId: string | undefined) {
  return useQuery({
    queryKey: key(obraId ?? ""),
    enabled: !!obraId,
    queryFn: async (): Promise<RdoEfetivoLinha[]> => {
      const { data, error } = await supabase
        .from("obra_rdo_efetivo")
        .select(
          "id, rdo_id, fornecedor_id, fornecedor_nome, quantidade, fornecedor:fornecedores(id, nome), obra_rdo!inner(obra_id)"
        )
        .eq("obra_rdo.obra_id", obraId!)
        .returns<RdoEfetivoLinha[]>();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export interface EntradaEfetivo {
  fornecedor_id?: string | null;
  fornecedor_nome?: string | null;
  quantidade: number;
}

/** Substitui o conjunto de linhas de efetivo de um dia (mesmo padrão de useSaveRdoTarefas). */
export function useSaveRdoEfetivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rdoId,
      entradas,
    }: {
      rdoId: string;
      obraId: string;
      entradas: EntradaEfetivo[];
    }): Promise<void> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

      const { error: delErr } = await supabase.from("obra_rdo_efetivo").delete().eq("rdo_id", rdoId);
      if (delErr) throw delErr;

      if (entradas.length > 0) {
        const rows = entradas.map((e) => ({
          empresa_id: empresaId,
          rdo_id: rdoId,
          fornecedor_id: e.fornecedor_id || null,
          fornecedor_nome: e.fornecedor_nome?.trim() || null,
          quantidade: e.quantidade,
        }));
        const { error: insErr } = await supabase.from("obra_rdo_efetivo").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_data, { obraId }) => {
      qc.invalidateQueries({ queryKey: key(obraId) });
    },
  });
}
