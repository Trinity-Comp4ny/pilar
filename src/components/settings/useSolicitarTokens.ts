import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { reportInvokeError } from "@/lib/monitoring";
import { getSafeErrorMessage } from "@/lib/safeError";

// Usuário travado pelo próprio teto de tokens pede mais ao administrador da
// empresa, sem sair do produto (spec 094). A RPC já barra um segundo pedido
// enquanto o anterior segue pendente (unique parcial no banco).
export function useSolicitarTokens() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mensagem, limiteSugerido }: { mensagem?: string; limiteSugerido?: number }) => {
      const { error } = await supabase.rpc("solicitar_mais_tokens", {
        p_mensagem: mensagem,
        p_limite_sugerido: limiteSugerido,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uso-empresa"] });
      toast.success("Pedido enviado", { description: "O administrador da sua empresa foi avisado." });
    },
    onError: (err) => {
      reportInvokeError(err, "solicitar_mais_tokens");
      toast.error("Não foi possível enviar o pedido", { description: getSafeErrorMessage(err) });
    },
  });
}
