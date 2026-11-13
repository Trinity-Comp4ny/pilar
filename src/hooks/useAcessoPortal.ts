import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Endereço de entrada do portal, para o escritório mandar por WhatsApp se quiser. */
export const linkDoPortal = () => `${window.location.origin}/cliente/login`;

/** Um acesso ao portal: uma pessoa (e-mail) do cliente. */
export interface AcessoPortal {
  id: string;
  email: string;
  /** Quem é (ex.: "Maria, esposa"); vazio = o próprio cliente. */
  nome: string | null;
  status: "ativo" | "convite_pendente";
  ultimoAcesso: string | null;
}

export const chaveAcessosPortal = (clienteId: string | undefined) => ["portal-acesso", clienteId] as const;

/**
 * Acessos do cliente ao portal (SPEC 164: vários por cliente, um por e-mail). Só os
 * ativos; convite ainda não aceito aparece como pendente.
 */
export function useAcessosPortal(clienteId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: chaveAcessosPortal(clienteId),
    queryFn: async (): Promise<AcessoPortal[]> => {
      const { data, error } = await supabase
        .from("cliente_portal_accounts")
        .select("id, email, nome, senha_hash, ultimo_acesso")
        .eq("cliente_id", clienteId!)
        .eq("ativo", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((a) => ({
        id: a.id as string,
        email: a.email as string,
        nome: (a.nome as string | null) ?? null,
        status: a.senha_hash ? "ativo" : "convite_pendente",
        ultimoAcesso: (a.ultimo_acesso as string | null) ?? null,
      }));
    },
    enabled: enabled && !!clienteId,
  });
}

/** Revoga um acesso só (os outros e-mails do cliente continuam entrando). */
export async function revogarAcessoPortal(accountId: string): Promise<void> {
  const { error } = await supabase.from("cliente_portal_accounts").update({ ativo: false }).eq("id", accountId);
  if (error) throw error;
}
