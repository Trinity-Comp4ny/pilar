import { useQuery } from "@tanstack/react-query";
import { untypedFrom } from "@/lib/supabaseRpc";

export interface Plan {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number;
  preco_anual: number | null;
  max_usuarios: number | null;
  max_projetos: number | null;
  features: string[];
  destaque: boolean;
  ordem: number;
}

interface PlanRow {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number;
  preco_anual: number | null;
  max_usuarios: number | null;
  max_projetos: number | null;
  features: unknown;
  destaque: boolean;
  ordem: number;
}

export function usePlans() {
  return useQuery({
    queryKey: ["pilar-subscription-plans"],
    queryFn: async () => {
      // Migration 027 ainda não refletida em types.ts; gen:types pendente.
      const { data, error } = await untypedFrom<PlanRow>("pilar_subscription_plans")
        .select(
          "id, slug, nome, descricao, preco_mensal, preco_anual, max_usuarios, max_projetos, features, destaque, ordem"
        )
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      if (error) throw new Error(error.message);

      return (data ?? []).map((plan) => ({
        ...plan,
        features: Array.isArray(plan.features) ? (plan.features as string[]) : [],
      })) as Plan[];
    },
    staleTime: 1000 * 60 * 60,
  });
}
