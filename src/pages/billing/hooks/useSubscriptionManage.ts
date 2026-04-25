import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UpdatePlanArgs {
  action: "update_plan";
  new_plan_slug: string;
  new_cycle: "monthly" | "yearly";
}

interface CancelArgs {
  action: "cancel";
}

type ManageArgs = UpdatePlanArgs | CancelArgs;

export function useSubscriptionManage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: ManageArgs) => {
      const { data, error } = await supabase.functions.invoke<{
        success?: boolean;
        error?: string;
      }>("pilar-subscription-manage", { body: args });

      if (error) throw new Error(error.message ?? "Erro ao gerenciar assinatura");
      if (!data?.success) throw new Error(data?.error ?? "Falha desconhecida");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pilar-my-subscription"] });
    },
  });
}
