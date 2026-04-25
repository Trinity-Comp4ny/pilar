import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Plan } from "@/pages/planos/hooks/usePlans";

export interface MySubscription {
  id: string;
  empresa_id: string;
  plan_id: string;
  status: "trialing" | "active" | "overdue" | "canceled" | "expired";
  billing_cycle: "monthly" | "yearly" | null;
  billing_type: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
  plan: Plan | null;
}

interface SubscriptionRow {
  id: string;
  empresa_id: string;
  plan_id: string;
  status: MySubscription["status"];
  billing_cycle: MySubscription["billing_cycle"];
  billing_type: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
  plan: Plan | null;
}

type AnyFrom = (table: string) => {
  select: (cols: string) => {
    maybeSingle: () => Promise<{
      data: SubscriptionRow | null;
      error: { message: string } | null;
    }>;
  };
};

export function useMySubscription() {
  return useQuery({
    queryKey: ["pilar-my-subscription"],
    queryFn: async (): Promise<MySubscription | null> => {
      const from = supabase.from as unknown as AnyFrom;
      const { data, error } = await from("pilar_subscriptions")
        .select(
          `id, empresa_id, plan_id, status, billing_cycle, billing_type,
           current_period_start, current_period_end, canceled_at, created_at,
           plan:pilar_subscription_plans(id, slug, nome, descricao, preco_mensal, preco_anual, max_usuarios, max_projetos, features, destaque, ordem)`
        )
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;

      return {
        ...data,
        plan: data.plan
          ? {
              ...data.plan,
              features: Array.isArray(data.plan.features) ? data.plan.features : [],
            }
          : null,
      };
    },
    staleTime: 1000 * 60,
  });
}
