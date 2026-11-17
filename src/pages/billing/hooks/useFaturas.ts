import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Fatura {
  id: string;
  status: string;
  value: number;
  due_date: string;
  payment_date: string | null;
  billing_type: string;
  /** Comprovante quando paga; fatura, boleto ou QR enquanto aberta. */
  url: string | null;
  paga: boolean;
}

/** Cobranças da assinatura (recibos e faturas), lidas do Asaas pela edge function. Só admin. */
export function useFaturas(enabled: boolean) {
  return useQuery({
    queryKey: ["pilar-faturas"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<Fatura[]> => {
      const { data, error } = await supabase.functions.invoke<{
        success?: boolean;
        error?: string;
        invoices?: Fatura[];
      }>("pilar-subscription-manage", { body: { action: "list_invoices" } });

      if (error) throw new Error(error.message ?? "Erro ao carregar faturas");
      if (!data?.success) throw new Error(data?.error ?? "Falha ao carregar faturas");
      return data.invoices ?? [];
    },
  });
}
