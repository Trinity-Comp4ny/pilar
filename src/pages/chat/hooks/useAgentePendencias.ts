import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Projetos em andamento sem orçamento por disciplina, vistos pelo agente de acompanhamento
 * (SPEC 146). Explica por que o guardião de margem não achou nada: ele só vigia projeto com
 * orçamento. Abrir a aba atualiza a fila da empresa (a função pula se rodou há menos de 5 min).
 */
export function usePendenciasOrcamentoAusente() {
  return useQuery({
    queryKey: ["agente_pendencias", "orcamento_ausente"],
    queryFn: async () => {
      const { error: erroAtualizar } = await supabase.rpc("agente_pendencias_atualizar");
      if (erroAtualizar) throw erroAtualizar;

      const { data, count, error } = await supabase
        .from("agente_pendencias")
        .select("projeto_id", { count: "exact" })
        .eq("tipo", "orcamento_ausente")
        .eq("status", "aberta")
        .order("primeira_deteccao", { ascending: true })
        .limit(1);
      if (error) throw error;
      return { total: count ?? 0, primeiroProjetoId: data?.[0]?.projeto_id ?? null };
    },
    staleTime: 1000 * 60 * 5,
  });
}
