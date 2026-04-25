import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BillingType } from "./useCheckoutCreate";

export interface CheckoutStatus {
  payment_status: "pending" | "paid" | "failed" | "canceled";
  billing_type: BillingType;
  billing_cycle: "monthly" | "yearly";
  paid_at: string | null;
  invite_dispatched: boolean;
  activated: boolean;
  email: string;
  plan: { slug: string; nome: string } | null;
  metadata: Record<string, unknown> | null;
}

export function useCheckoutStatus(sessionToken: string | null, enabled = true) {
  return useQuery({
    queryKey: ["pilar-checkout-status", sessionToken],
    enabled: enabled && !!sessionToken,
    refetchInterval: (query) => {
      const status = query.state.data?.payment_status;
      if (status === "paid" || status === "failed" || status === "canceled") {
        return false;
      }
      return 4000;
    },
    queryFn: async (): Promise<CheckoutStatus> => {
      const { data, error } = await supabase.functions.invoke<CheckoutStatus>("pilar-checkout-status", {
        body: { session_token: sessionToken },
      });

      if (error) throw new Error(error.message ?? "Erro ao consultar status");
      if (!data) throw new Error("Resposta vazia");
      return data;
    },
  });
}
