import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type BillingType = "PIX" | "BOLETO";
export type AsaasAmbiente = "sandbox" | "producao";

export interface AsaasConfig {
  configurado: boolean;
  ambiente: AsaasAmbiente;
  webhook_token: string;
}

export interface AsaasCobrancaResult {
  success: boolean;
  payment_id: string;
  payment_url: string | null;
  status: string;
}

export function useAsaasCriarCobranca(onSuccess?: () => void) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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

      toast({
        title: "Cobrança criada no Asaas",
        description: `${billingType === "PIX" ? "Pix" : "Boleto"} gerado com sucesso`,
      });

      onSuccess?.();
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao criar cobrança";
      toast({ title: "Erro Asaas", description: message, variant: "destructive" });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { criarCobranca, isLoading };
}

export function useAsaasConfig() {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerando, setIsRegenerando] = useState(false);
  const { toast } = useToast();

  const carregarConfig = async (): Promise<AsaasConfig | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-config", {
        body: { action: "get" },
      });

      if (error) throw error;

      const result = data as { data: { configurado: boolean; ambiente: string; webhook_token: string } | null };
      return result?.data
        ? {
            configurado: result.data.configurado,
            ambiente: result.data.ambiente as AsaasAmbiente,
            webhook_token: result.data.webhook_token,
          }
        : null;
    } catch {
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const salvarConfig = async (config: { apiKey?: string; ambiente: AsaasAmbiente }): Promise<AsaasConfig | null> => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-config", {
        body: { action: "save", api_key: config.apiKey, ambiente: config.ambiente },
      });

      if (error) throw error;

      const result = data as { success?: boolean; error?: string; data?: AsaasConfig };
      if (result?.error) throw new Error(result.error);

      toast({ title: "Configuração Asaas salva" });
      return result.data ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao salvar";
      toast({ title: "Erro ao salvar", description: message, variant: "destructive" });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const regenerarToken = async (): Promise<string | null> => {
    setIsRegenerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-config", {
        body: { action: "regenerar_token" },
      });

      if (error) throw error;

      const result = data as { success?: boolean; webhook_token?: string; error?: string };
      if (result?.error) throw new Error(result.error);

      toast({ title: "Token regenerado", description: "Atualize o token no painel Asaas" });
      return result.webhook_token ?? null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao regenerar token";
      toast({ title: "Erro", description: message, variant: "destructive" });
      return null;
    } finally {
      setIsRegenerando(false);
    }
  };

  return { carregarConfig, salvarConfig, regenerarToken, isSaving, isLoading, isRegenerando };
}
