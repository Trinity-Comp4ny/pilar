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

// Migration 027 ainda não refletida em types.ts (regerar com `npm run gen:types`).
// Cast pra any é intencional enquanto os tipos não forem atualizados.
type AnyFrom = (table: string) => {
  select: (cols: string) => {
    eq: (
      col: string,
      val: unknown
    ) => {
      order: (
        col: string,
        opts: { ascending: boolean }
      ) => Promise<{
        data: PlanRow[] | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export function usePlans() {
  return useQuery({
    queryKey: ["pilar-subscription-plans"],
    queryFn: async () => {
      const from = supabase.from as unknown as AnyFrom;
      const { data, error } = await from("pilar_subscription_plans")
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
