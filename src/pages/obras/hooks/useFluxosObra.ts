import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { normalizarEstrutura, type EstruturaFluxo } from "@/pages/obras/lib/fluxoObra";

export interface FluxoObra {
  id: string;
  nome: string;
  descricao: string | null;
  estrutura: EstruturaFluxo;
}

const KEY = ["fluxos-obra"] as const;

/** Fluxos de cronograma de obra da empresa, em ordem alfabética. */
export function useFluxosObra() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<FluxoObra[]> => {
      const { data, error } = await supabase
        .from("fluxos_obra")
        .select("id, nome, descricao, estrutura")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []).map((f) => ({ ...f, estrutura: normalizarEstrutura(f.estrutura) }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useSalvarFluxoObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: {
      id?: string;
      nome: string;
      descricao?: string | null;
      estrutura: EstruturaFluxo;
    }): Promise<string> => {
      const campos = {
        nome: f.nome.trim(),
        descricao: f.descricao?.trim() || null,
        estrutura: f.estrutura as unknown as Json,
      };
      if (f.id) {
        const { error } = await supabase.from("fluxos_obra").update(campos).eq("id", f.id);
        if (error) throw error;
        return f.id;
      }
      const { data: empresaId } = await supabase.rpc("get_user_empresa_id");
      if (!empresaId) throw new Error("Usuário não vinculado a uma empresa");
      const { data, error } = await supabase
        .from("fluxos_obra")
        .insert({ ...campos, empresa_id: empresaId })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Exclusão leve (padrão do app): marca deleted_at. */
export function useExcluirFluxoObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fluxos_obra")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
