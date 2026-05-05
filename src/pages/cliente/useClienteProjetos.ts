import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPortalToken } from "@/hooks/useClienteAuth";

export interface ClienteProjeto {
  projeto_id: string;
  projeto_nome: string;
  projeto_codigo: string | null;
  projeto_status: string;
  data_inicio: string | null;
  data_previsao: string | null;
  valor_contrato: number | null;
  disciplinas: Array<{ disciplina?: string; status?: string }>;
  empresa_nome: string;
}

export function useClienteProjetos() {
  const [projetos, setProjetos] = useState<ClienteProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const token = getPortalToken();
        if (!token) throw new Error("Não autenticado");

        const { data, error: rpcError } = await supabase.rpc("get_cliente_projetos", {
          p_token: token,
        });
        if (rpcError) throw rpcError;
        // RPC get_cliente_projetos retorna Json; shape é contrato do backend.
        setProjetos((data as unknown as ClienteProjeto[] | null) ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erro ao carregar projetos");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  return { projetos, loading, error };
}
