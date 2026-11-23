import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Margem-alvo que a proposta prometeu (SPEC 168), vinda de projeto_orcamento_fases.margem_alvo_pct
 * na conversão proposta -> projeto. Média ponderada pelo valor de venda das disciplinas.
 * Null quando o projeto não tem orçamento por disciplina.
 */
export const calcMargemPrometida = (
  fases: { margem_alvo_pct: number | null; valor_venda: number | null }[]
): number | null => {
  const validas = fases.filter((f) => f.margem_alvo_pct !== null);
  if (validas.length === 0) return null;
  const peso = validas.reduce((s, f) => s + (Number(f.valor_venda) || 0), 0);
  if (peso <= 0) return validas.reduce((s, f) => s + Number(f.margem_alvo_pct), 0) / validas.length;
  return validas.reduce((s, f) => s + Number(f.margem_alvo_pct) * (Number(f.valor_venda) || 0), 0) / peso;
};

export const useMargemPrometida = (projetoId: string | undefined, enabled = true) =>
  useQuery({
    queryKey: ["projeto-margem-prometida", projetoId],
    enabled: enabled && !!projetoId,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from("projeto_orcamento_fases")
        .select("margem_alvo_pct, valor_venda")
        .eq("projeto_id", projetoId!);
      if (error) throw error;
      return calcMargemPrometida(data ?? []);
    },
  });
