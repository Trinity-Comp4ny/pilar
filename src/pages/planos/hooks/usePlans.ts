import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

export function calculateYearlySavingPct(plan: Plan): number | null {
  if (!plan.preco_anual || plan.preco_mensal <= 0) return null;
  const fullYear = plan.preco_mensal * 12;
  if (plan.preco_anual >= fullYear) return null;
  return Math.round(((fullYear - plan.preco_anual) / fullYear) * 100);
}

export function usePlans() {
  return useQuery({
    queryKey: ["pilar-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pilar_subscription_plans")
        .select("id, slug, nome, descricao, preco_mensal, preco_anual, max_usuarios, max_projetos, features, destaque, ordem")
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
