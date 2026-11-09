import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCreditos } from "@/lib/creditos";

export interface Plan {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  preco_mensal: number;
  preco_anual: number | null;
  max_usuarios: number | null;
  max_projetos: number | null;
  max_obras: number | null;
  max_leads: number | null;
  /** Cota mensal de IA em tokens; a UI mostra em créditos (lib/creditos.ts). */
  tokens_mensais: number | null;
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

/**
 * O que separa um plano do outro (DECISOES.md 2026-11-06): faixa de projetos,
 * obras e leads ativos, mais a cota de créditos de IA. Uma linha por item.
 */
export function capacidadeDoPlano(plan: Plan): string[] {
  const faixa = (max: number | null, singular: string, plural: string, ilimitado: string) =>
    max == null ? ilimitado : `Até ${max} ${max === 1 ? singular : plural}`;
  const linhas = [
    faixa(plan.max_projetos, "projeto ativo", "projetos ativos", "Projetos ilimitados"),
    faixa(plan.max_obras, "obra ativa", "obras ativas", "Obras ilimitadas"),
    faixa(plan.max_leads, "lead ativo", "leads ativos", "Leads ilimitados"),
  ];
  if (plan.tokens_mensais != null) linhas.push(`${formatCreditos(plan.tokens_mensais)} de IA por mês`);
  return linhas;
}

export function usePlans() {
  return useQuery({
    queryKey: ["pilar-subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pilar_subscription_plans")
        .select(
          "id, slug, nome, descricao, preco_mensal, preco_anual, max_usuarios, max_projetos, max_obras, max_leads, tokens_mensais, features, destaque, ordem"
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
