import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionError";
import type { BillingCycle } from "@/pages/planos/components/CycleToggle";

export type BillingType = "CREDIT_CARD" | "PIX" | "BOLETO";

export interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone?: string;
}

export interface CheckoutPayload {
  email: string;
  nome: string;
  company_name: string;
  cpf_cnpj: string;
  telefone?: string;
  plan_slug: string;
  billing_cycle: BillingCycle;
  billing_type: BillingType;
  credit_card?: CreditCardData;
  credit_card_holder_info?: CreditCardHolderInfo;
}

export interface CheckoutResponse {
  success: true;
  session_token: string;
  billing_type: BillingType;
  payment_status: "pending" | "paid";
  plan: {
    slug: string;
    nome: string;
    cycle: BillingCycle;
    value: number;
  };
  metadata: {
    billing_type: BillingType;
    value: number;
    cycle: BillingCycle;
    payment_id: string | null;
    invoice_url: string | null;
    pix?: {
      encoded_image: string;
      payload: string;
      expiration_date: string;
    };
    boleto?: {
      bank_slip_url: string | null;
      identification_field: string | null;
      nosso_numero: string | null;
    };
  };
}

export function useCheckoutCreate() {
  return useMutation({
    mutationFn: async (payload: CheckoutPayload): Promise<CheckoutResponse> => {
      const { data, error } = await supabase.functions.invoke<CheckoutResponse>("pilar-checkout-create", {
        body: payload,
      });

      if (error) {
        throw new Error(await edgeFunctionErrorMessage(error, "Erro ao processar checkout"));
      }

      if (!data || !("success" in data) || !data.success) {
        const errorPayload = data as { error?: string } | null;
        throw new Error(errorPayload?.error ?? "Falha ao criar cobrança");
      }

      return data;
    },
  });
}
