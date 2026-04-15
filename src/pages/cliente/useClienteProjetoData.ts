import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPortalToken } from "./useClienteAuth";

export interface ClienteProjetoData {
  projeto_id: string;
  cliente_id: string;
  empresa_id: string;
  projeto_nome: string;
  projeto_status: string;
  projeto_codigo: string | null;
  data_inicio: string | null;
  data_previsao: string | null;
  data_final: string | null;
  valor_contrato: number | null;
  disciplinas: Array<{ disciplina?: string; status?: string }>;
  cliente_nome: string;
  empresa_nome: string;
}

export function useClienteProjetoData(projetoId: string | undefined) {
  const [data, setData] = useState<ClienteProjetoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projetoId) return;

    const fetch = async () => {
      try {
        const token = getPortalToken();
        if (!token) throw new Error("Não autenticado");

        const { data: result, error: rpcError } = await supabase.rpc("get_cliente_projeto_detail", {
          p_projeto_id: projetoId,
          p_token: token,
        });
        if (rpcError) throw rpcError;
        setData(result as unknown as ClienteProjetoData);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erro ao carregar projeto");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [projetoId]);

  return { data, loading, error };
}
