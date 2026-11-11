import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PortalStatus } from "@/hooks/useClientes";

/** Endereço de entrada do portal, para o escritório mandar por WhatsApp se quiser. */
export const linkDoPortal = () => `${window.location.origin}/cliente/login`;

interface AcessoPortal {
  status: PortalStatus;
  email: string | null;
}

/** Estado do acesso do cliente ao portal: sem acesso, convite não aceito ou ativo. */
export function useAcessoPortal(clienteId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["portal-acesso", clienteId],
    queryFn: async (): Promise<AcessoPortal> => {
      const { data, error } = await supabase
        .from("cliente_portal_accounts")
        .select("email, senha_hash")
        .eq("cliente_id", clienteId!)
        .eq("ativo", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { status: "sem_acesso", email: null };
      return { status: data.senha_hash ? "ativo" : "convite_pendente", email: data.email as string };
    },
    enabled: enabled && !!clienteId,
  });
}
