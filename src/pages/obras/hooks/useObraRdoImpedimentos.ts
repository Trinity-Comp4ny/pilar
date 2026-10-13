import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TipoImpedimento } from "@/lib/obras";

export interface RdoImpedimento {
  id: string;
  rdo_id: string;
  descricao: string;
  tipo: TipoImpedimento;
}

const key = (obraId: string) => ["obra_rdo_impedimento", obraId] as const;

/** Todos os impedimentos lançados nos dias de uma obra. */
export function useObraRdoImpedimentos(obraId: string | undefined) {
  return useQuery({
    queryKey: key(obraId ?? ""),
    enabled: !!obraId,
    queryFn: async (): Promise<RdoImpedimento[]> => {
      const { data, error } = await supabase
        .from("obra_rdo_impedimento")
        .select("id, rdo_id, descricao, tipo, obra_rdo!inner(obra_id)")
        .eq("obra_rdo.obra_id", obraId!)
        .returns<RdoImpedimento[]>();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export interface EntradaImpedimento {
  descricao: string;
  tipo: TipoImpedimento;
}

/** Substitui o conjunto de impedimentos de um dia (mesmo padrão de useSaveRdoTarefas). */
export function useSaveRdoImpedimentos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rdoId,
      entradas,
    }: {
      rdoId: string;
      obraId: string;
      entradas: EntradaImpedimento[];
    }): Promise<void> => {
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");

      const { error: delErr } = await supabase.from("obra_rdo_impedimento").delete().eq("rdo_id", rdoId);
      if (delErr) throw delErr;

      if (entradas.length > 0) {
        const rows = entradas.map((e) => ({
          empresa_id: empresaId,
          rdo_id: rdoId,
          descricao: e.descricao.trim(),
          tipo: e.tipo,
        }));
        const { error: insErr } = await supabase.from("obra_rdo_impedimento").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_data, { obraId }) => {
      qc.invalidateQueries({ queryKey: key(obraId) });
    },
  });
}
