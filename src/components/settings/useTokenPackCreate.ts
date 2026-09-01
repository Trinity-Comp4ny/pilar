import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TokenPackBillingType = "PIX" | "BOLETO" | "CREDIT_CARD";
export type TokenPackTierId = "starter" | "cresce" | "escala" | "maximo";

export interface TokenPackCreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface TokenPackCreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone?: string;
}

export interface TokenPackCreatePayload {
  tier_id: TokenPackTierId;
  billing_type: TokenPackBillingType;
  credit_card?: TokenPackCreditCardData;
  credit_card_holder_info?: TokenPackCreditCardHolderInfo;
}

export interface TokenPackCreateResponse {
  success: true;
  purchase_id: string;
  billing_type: TokenPackBillingType;
  payment_status: "pending" | "paid";
  tokens: number;
  value: number;
  metadata: {
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

// Mesmo padrão de useCheckoutCreate.ts (checkout público): supabase.functions.invoke
// já injeta o JWT do usuário logado, então não é preciso passar Authorization à mão.
export function useTokenPackCreate() {
  return useMutation({
    mutationFn: async (payload: TokenPackCreatePayload): Promise<TokenPackCreateResponse> => {
      const { data, error } = await supabase.functions.invoke<TokenPackCreateResponse>("pilar-token-pack-create", {
        body: payload,
      });

      if (error) {
        const message = error.message ?? "Erro ao processar compra";
        throw new Error(message);
      }

      if (!data || !("success" in data) || !data.success) {
        const errorPayload = data as { error?: string } | null;
        throw new Error(errorPayload?.error ?? "Falha ao criar cobrança");
      }

      return data;
    },
  });
}
