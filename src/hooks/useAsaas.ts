import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { reportInvokeError } from "@/lib/monitoring";

export type BillingType = "PIX" | "BOLETO";

export interface AsaasCobrancaResult {
  success: boolean;
  payment_id: string;
  payment_url: string | null;
  status: string;
}

export function useAsaasCriarCobranca(onSuccess?: () => void) {
  const [isLoading, setIsLoading] = useState(false);

  const criarCobranca = async (receitaId: string, billingType: BillingType): Promise<AsaasCobrancaResult | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-criar-cobranca", {
        body: { receita_id: receitaId, billing_type: billingType },
      });

      if (error) {
        const context = (error as { context?: Response }).context;
        if (context) {
          try {
            const body = (await context.json()) as { error?: string };
            throw new Error(body.error ?? error.message);
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== error.message) throw parseErr;
          }
        }
        throw error;
      }

      const result = data as AsaasCobrancaResult & { error?: string };
      if (result.error) throw new Error(result.error);

      toast.success("Cobrança criada no Asaas", {
        description: `${billingType === "PIX" ? "Pix" : "Boleto"} gerado com sucesso`,
      });

      onSuccess?.();
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar cobrança";
      reportInvokeError(err, "asaas-criar-cobranca");
      toast.error("Erro Asaas", { description: message });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { criarCobranca, isLoading };
}
